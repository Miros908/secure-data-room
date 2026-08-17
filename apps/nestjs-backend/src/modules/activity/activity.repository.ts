import { Injectable } from '@nestjs/common';
import { GUEST_ACTIVITY_NAME, type ActivityActor } from '@sdr/shared/activity';
import { ActivityEventType } from '../../database/generated/prisma/enums';
import type { Prisma } from '../../database/generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  PRISMA_INTERACTIVE_TRANSACTION,
  type PrismaDb,
  type PrismaTx,
} from '../../database/prisma-transaction';
import { currentRequestId } from '../../request-id.middleware';
import {
  ACTIVITY_DEDUP_MS,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_TOP_FILES,
  ACTIVITY_TYPE_FROM_API,
  ACTIVITY_TYPE_TO_API,
  decodeTimelineCursor,
  encodeTimelineCursor,
  linkActorKey,
  parseActorKey,
  userActorKey,
} from './activity.constants';
import type {
  ActivityAppendInput,
  ActivityFileSnapshot,
  ActivityFileVersionSnapshot,
  ActivityOwnedRoom,
} from './activity.types';
import type {
  ActivityEvent,
  ActivityEventTypeDto,
  ActivitySummary,
  ActivityTimeline,
  ActivityTopFile,
  ActivityVisitor,
} from '@sdr/shared/activity';

const FILE_SNAPSHOT_SELECT = {
  id: true,
  name: true,
  data_room_id: true,
  folder_id: true,
  mime_type: true,
  current_version: { select: { storage_key: true } },
} as const;

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    input: ActivityAppendInput,
    tx?: PrismaTx,
  ): Promise<{ id: string } | null> {
    if (input.dedupe && !tx) {
      return this.prisma.$transaction(
        (inner) => this.writeEvent(inner, input),
        PRISMA_INTERACTIVE_TRANSACTION,
      );
    }

    return this.writeEvent(this.db(tx), input);
  }

  private async writeEvent(
    db: PrismaDb,
    input: ActivityAppendInput,
  ): Promise<{ id: string } | null> {
    if (input.dedupe) {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeLockKey(input)}))`;
      const duplicate = await this.findRecentDuplicate(db, input);
      if (duplicate) {
        return null;
      }
    }

    return db.activity_events.create({
      data: {
        data_room_id: input.dataRoomId,
        type: input.type,
        actor_user_id: input.actorUserId ?? null,
        public_share_link_id: input.publicShareLinkId ?? null,
        file_id: input.fileId ?? null,
        folder_id: input.folderId ?? null,
        resource_name: input.resourceName ?? null,
        request_id: currentRequestId(),
        metadata: toJson(input.metadata),
      },
      select: { id: true },
    });
  }

  async findDataRoomOwnerId(id: string): Promise<string | null> {
    const room = await this.prisma.data_rooms.findFirst({
      where: { id },
      select: { owner_id: true },
    });

    return room?.owner_id ?? null;
  }

  async findOwnedRoom(
    roomId: string,
    ownerId: string,
  ): Promise<ActivityOwnedRoom | null> {
    const room = await this.prisma.data_rooms.findFirst({
      where: { id: roomId, owner_id: ownerId },
      select: { id: true, owner_id: true },
    });

    return room ? { id: room.id, ownerId: room.owner_id } : null;
  }

  async findFileSnapshot(id: string): Promise<ActivityFileSnapshot | null> {
    const file = await this.prisma.files.findUnique({
      where: { id },
      select: FILE_SNAPSHOT_SELECT,
    });

    if (!file?.current_version) {
      return null;
    }

    return {
      id: file.id,
      name: file.name,
      dataRoomId: file.data_room_id,
      folderId: file.folder_id,
      storageKey: file.current_version.storage_key,
      mimeType: file.mime_type,
    };
  }

  async findFileVersionSnapshot(
    fileId: string,
    versionId: string,
  ): Promise<ActivityFileVersionSnapshot | null> {
    const version = await this.prisma.file_versions.findFirst({
      where: { id: versionId, file_id: fileId },
      select: {
        id: true,
        file_id: true,
        storage_key: true,
        mime_type: true,
      },
    });

    return version
      ? {
          id: version.id,
          fileId: version.file_id,
          storageKey: version.storage_key,
          mimeType: version.mime_type,
        }
      : null;
  }

  async summarize(roomId: string, ownerId: string): Promise<ActivitySummary> {
    const excludeOwner: Prisma.activity_eventsWhereInput = {
      OR: [{ actor_user_id: null }, { actor_user_id: { not: ownerId } }],
    };
    const accessWhere: Prisma.activity_eventsWhereInput = {
      data_room_id: roomId,
      type: {
        in: [
          ActivityEventType.FILE_VIEWED,
          ActivityEventType.FILE_DOWNLOADED,
          ActivityEventType.LINK_OPENED,
        ],
      },
      ...excludeOwner,
    };

    const [userGroups, guestGroups, fileGroups] = await Promise.all([
      this.prisma.activity_events.groupBy({
        by: ['actor_user_id', 'type'],
        where: { ...accessWhere, actor_user_id: { not: null } },
        _count: { _all: true },
        _max: { created_at: true },
        _min: { created_at: true },
      }),
      this.prisma.activity_events.groupBy({
        by: ['public_share_link_id', 'type'],
        where: {
          ...accessWhere,
          actor_user_id: null,
          public_share_link_id: { not: null },
        },
        _count: { _all: true },
        _max: { created_at: true },
        _min: { created_at: true },
      }),
      this.prisma.activity_events.groupBy({
        by: ['file_id', 'type'],
        where: {
          data_room_id: roomId,
          file_id: { not: null },
          type: {
            in: [
              ActivityEventType.FILE_VIEWED,
              ActivityEventType.FILE_DOWNLOADED,
            ],
          },
          ...excludeOwner,
        },
        _count: { _all: true },
        _max: { created_at: true },
      }),
    ]);

    const visitors = await this.toVisitors(userGroups, guestGroups);
    const topFiles = await this.toTopFiles(roomId, fileGroups);

    let views = 0;
    let downloads = 0;
    let linkOpens = 0;
    for (const group of [...userGroups, ...guestGroups]) {
      if (group.type === ActivityEventType.FILE_VIEWED) {
        views += group._count._all;
      } else if (group.type === ActivityEventType.FILE_DOWNLOADED) {
        downloads += group._count._all;
      } else if (group.type === ActivityEventType.LINK_OPENED) {
        linkOpens += group._count._all;
      }
    }

    return {
      visitors,
      topFiles,
      totals: {
        views,
        downloads,
        uniqueVisitors: visitors.length,
        linkOpens,
      },
    };
  }

  async listTimeline(params: {
    roomId: string;
    cursor?: string;
    limit?: number;
    actorKey?: string;
    type?: ActivityEventTypeDto;
  }): Promise<ActivityTimeline> {
    const take = params.limit ?? ACTIVITY_PAGE_SIZE;
    const decoded = params.cursor ? decodeTimelineCursor(params.cursor) : null;
    const actorFilter = params.actorKey
      ? actorWhere(params.actorKey)
      : undefined;

    if (params.cursor && !decoded) {
      return { events: [], nextCursor: null };
    }

    if (params.actorKey && !actorFilter) {
      return { events: [], nextCursor: null };
    }

    const rows = await this.prisma.activity_events.findMany({
      where: {
        data_room_id: params.roomId,
        ...(params.type ? { type: ACTIVITY_TYPE_FROM_API[params.type] } : {}),
        ...actorFilter,
        ...(decoded
          ? {
              OR: [
                { created_at: { lt: decoded.createdAt } },
                { created_at: decoded.createdAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        type: true,
        created_at: true,
        actor_user_id: true,
        public_share_link_id: true,
        file_id: true,
        folder_id: true,
        resource_name: true,
        metadata: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    const page = rows.slice(0, take);
    const last = page[page.length - 1];

    return {
      events: page.map(toEvent),
      nextCursor:
        rows.length > take && last
          ? encodeTimelineCursor(last.created_at, last.id)
          : null,
    };
  }

  private async findRecentDuplicate(
    db: PrismaDb,
    input: ActivityAppendInput,
  ): Promise<{ id: string } | null> {
    const since = new Date(Date.now() - ACTIVITY_DEDUP_MS);
    return db.activity_events.findFirst({
      where: {
        data_room_id: input.dataRoomId,
        type: input.type,
        created_at: { gte: since },
        actor_user_id: input.actorUserId ?? null,
        public_share_link_id: input.publicShareLinkId ?? null,
        file_id: input.fileId ?? null,
        folder_id: input.folderId ?? null,
      },
      select: { id: true },
    });
  }

  private async toVisitors(
    userGroups: GroupRow[],
    guestGroups: GuestGroupRow[],
  ): Promise<ActivityVisitor[]> {
    const users = new Map<string, VisitorAcc>();
    for (const group of userGroups) {
      if (!group.actor_user_id) {
        continue;
      }
      accVisitor(
        users,
        group.actor_user_id,
        group.type,
        group._count._all,
        group._min.created_at,
        group._max.created_at,
      );
    }

    const guests = new Map<string, VisitorAcc>();
    for (const group of guestGroups) {
      if (!group.public_share_link_id) {
        continue;
      }
      accVisitor(
        guests,
        group.public_share_link_id,
        group.type,
        group._count._all,
        group._min.created_at,
        group._max.created_at,
      );
    }

    const userRows =
      users.size === 0
        ? []
        : await this.prisma.users.findMany({
            where: { id: { in: [...users.keys()] } },
            select: { id: true, name: true, email: true },
          });
    const names = new Map(userRows.map((user) => [user.id, user]));

    const visitors: ActivityVisitor[] = [
      ...[...users.entries()].map(([id, acc]) =>
        toVisitor(
          {
            key: userActorKey(id),
            kind: 'user',
            name: names.get(id)?.name ?? 'Пользователь',
            email: names.get(id)?.email ?? null,
          },
          acc,
        ),
      ),
      ...[...guests.entries()].map(([id, acc]) =>
        toVisitor(
          {
            key: linkActorKey(id),
            kind: 'guest',
            name: GUEST_ACTIVITY_NAME,
            email: null,
          },
          acc,
        ),
      ),
    ];

    visitors.sort(
      (left, right) =>
        new Date(right.lastSeenAt).getTime() -
        new Date(left.lastSeenAt).getTime(),
    );
    return visitors;
  }

  private async toTopFiles(
    roomId: string,
    fileGroups: FileGroupRow[],
  ): Promise<ActivityTopFile[]> {
    const files = new Map<
      string,
      { views: number; downloads: number; last: Date | null }
    >();
    for (const group of fileGroups) {
      if (!group.file_id) {
        continue;
      }
      const current = files.get(group.file_id) ?? {
        views: 0,
        downloads: 0,
        last: null,
      };
      if (group.type === ActivityEventType.FILE_VIEWED) {
        current.views += group._count._all;
        current.last = later(current.last, group._max.created_at);
      } else if (group.type === ActivityEventType.FILE_DOWNLOADED) {
        current.downloads += group._count._all;
      }
      files.set(group.file_id, current);
    }

    const ranked = [...files.entries()]
      .sort((left, right) => right[1].views - left[1].views)
      .slice(0, ACTIVITY_TOP_FILES);

    if (ranked.length === 0) {
      return [];
    }

    const names = await this.prisma.activity_events.findMany({
      where: {
        data_room_id: roomId,
        file_id: { in: ranked.map(([id]) => id) },
        resource_name: { not: null },
      },
      select: { file_id: true, resource_name: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    const nameByFile = new Map<string, string>();
    for (const row of names) {
      if (row.file_id && row.resource_name && !nameByFile.has(row.file_id)) {
        nameByFile.set(row.file_id, row.resource_name);
      }
    }

    return ranked.map(([fileId, stats]) => ({
      fileId,
      name: nameByFile.get(fileId) ?? 'Документ',
      viewCount: stats.views,
      downloadCount: stats.downloads,
      lastViewedAt: stats.last?.toISOString() ?? null,
    }));
  }

  private db(tx?: PrismaTx): PrismaDb {
    return tx ?? this.prisma;
  }
}

type GroupRow = {
  actor_user_id: string | null;
  type: ActivityEventType;
  _count: { _all: number };
  _max: { created_at: Date | null };
  _min: { created_at: Date | null };
};

type GuestGroupRow = {
  public_share_link_id: string | null;
  type: ActivityEventType;
  _count: { _all: number };
  _max: { created_at: Date | null };
  _min: { created_at: Date | null };
};

type FileGroupRow = {
  file_id: string | null;
  type: ActivityEventType;
  _count: { _all: number };
  _max: { created_at: Date | null };
};

type VisitorAcc = {
  viewCount: number;
  downloadCount: number;
  lastSeenAt: Date;
  firstSeenAt: Date;
};

function accVisitor(
  map: Map<string, VisitorAcc>,
  id: string,
  type: ActivityEventType,
  count: number,
  min: Date | null,
  max: Date | null,
) {
  const current = map.get(id) ?? {
    viewCount: 0,
    downloadCount: 0,
    lastSeenAt: max ?? new Date(0),
    firstSeenAt: min ?? new Date(),
  };
  if (type === ActivityEventType.FILE_VIEWED) {
    current.viewCount += count;
  }
  if (type === ActivityEventType.FILE_DOWNLOADED) {
    current.downloadCount += count;
  }
  if (max && max.getTime() > current.lastSeenAt.getTime()) {
    current.lastSeenAt = max;
  }
  if (min && min.getTime() < current.firstSeenAt.getTime()) {
    current.firstSeenAt = min;
  }
  map.set(id, current);
}

function toVisitor(actor: ActivityActor, acc: VisitorAcc): ActivityVisitor {
  return {
    actor,
    viewCount: acc.viewCount,
    downloadCount: acc.downloadCount,
    lastSeenAt: acc.lastSeenAt.toISOString(),
    firstSeenAt: acc.firstSeenAt.toISOString(),
  };
}

function toEvent(row: {
  id: string;
  type: ActivityEventType;
  created_at: Date;
  actor_user_id: string | null;
  public_share_link_id: string | null;
  file_id: string | null;
  folder_id: string | null;
  resource_name: string | null;
  metadata: Prisma.JsonValue;
  actor: { name: string; email: string } | null;
}): ActivityEvent {
  return {
    id: row.id,
    type: ACTIVITY_TYPE_TO_API[row.type],
    createdAt: row.created_at.toISOString(),
    actor: toActor(row),
    fileId: row.file_id,
    folderId: row.folder_id,
    resourceName: row.resource_name,
    metadata: asRecord(row.metadata),
  };
}

function toActor(row: {
  actor_user_id: string | null;
  public_share_link_id: string | null;
  actor: { name: string; email: string } | null;
}): ActivityActor {
  if (row.actor_user_id) {
    return {
      key: userActorKey(row.actor_user_id),
      kind: 'user',
      name: row.actor?.name ?? 'Пользователь',
      email: row.actor?.email ?? null,
    };
  }

  return {
    key: row.public_share_link_id
      ? linkActorKey(row.public_share_link_id)
      : 'link:unknown',
    kind: 'guest',
    name: GUEST_ACTIVITY_NAME,
    email: null,
  };
}

function actorWhere(key: string): Prisma.activity_eventsWhereInput | undefined {
  const parsed = parseActorKey(key);
  if (!parsed) {
    return undefined;
  }

  if (parsed.kind === 'user') {
    return { actor_user_id: parsed.userId };
  }

  return {
    actor_user_id: null,
    public_share_link_id: parsed.linkId,
  };
}

function later(current: Date | null, next: Date | null): Date | null {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  return next.getTime() > current.getTime() ? next : current;
}

function dedupeLockKey(input: ActivityAppendInput): string {
  return [
    input.dataRoomId,
    input.type,
    input.actorUserId ?? '',
    input.publicShareLinkId ?? '',
    input.fileId ?? '',
    input.folderId ?? '',
  ].join(':');
}

function toJson(
  metadata: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }

  return metadata as Prisma.InputJsonValue;
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
