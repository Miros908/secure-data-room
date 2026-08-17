import { Injectable } from '@nestjs/common';
import { AccessRole } from '../../database/generated/prisma/enums';
import type { Prisma } from '../../database/generated/prisma/client';
import {
  PRISMA_INTERACTIVE_TRANSACTION,
  type PrismaTx,
} from '../../database/prisma-transaction';
import { PrismaService } from '../../database/prisma.service';
import type { GrantRole } from './access.constants';
import type {
  AccessSubject,
  CoveringAccessQuery,
  CoveringGrantQuery,
  CoveringPublicLinkQuery,
} from './access.types';
import { isGrantUpgrade } from './utils/resolve-access';
import type { AccessTarget } from './utils/subject-target';

const GRANT_SELECT = {
  id: true,
  user_id: true,
  role: true,
  data_room_id: true,
  folder_id: true,
  file_id: true,
  expires_at: true,
} as const;

const TARGET_SELECT = {
  id: true,
  data_room_id: true,
  folder_id: true,
  file_id: true,
} as const;

const PUBLIC_LINK_TARGET_SELECT = {
  ...TARGET_SELECT,
  expires_at: true,
} as const;

export type AccessGrantRecord = {
  id: string;
  userId: string;
  role: GrantRole;
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
  expiresAt: Date | null;
};

export type AccessUserRecord = {
  id: string;
  email: string;
  name: string;
};

export type AccessInvitationRecord = {
  id: string;
  email: string;
  role: GrantRole;
  grantedById: string;
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
  expiresAt: Date;
  accessExpiresAt: Date | null;
};

export type PublicShareLinkRecord = {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
  expiresAt: Date | null;
};

export type ShareGrantRecord = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: GrantRole;
  expiresAt: Date | null;
};

export type ShareTargetRecord = {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
  expiresAt?: Date | null;
};

export type IncomingShareRecord = {
  role: GrantRole;
  dataRoomId: string;
  dataRoomName: string;
  folder: { id: string; name: string } | null;
  file: { id: string; name: string } | null;
  expiresAt: Date | null;
};

export type TargetCoverageRecord = {
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
  peopleCount: number;
  pendingCount: number;
  hasPublicLink: boolean;
};

export type FolderMetaRecord = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  dataRoomId: string;
};

export type FileMetaRecord = {
  id: string;
  name: string;
  folderId: string | null;
  dataRoomId: string;
};

export type DataRoomMetaRecord = {
  id: string;
  name: string;
};

export type RoomSearchGrantRecord = {
  role: GrantRole;
  expiresAt: Date | null;
  folderId: string | null;
  fileId: string | null;
  folderPath: string | null;
};

@Injectable()
export class AccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCoveringGrants(
    params: CoveringGrantQuery,
  ): Promise<Array<{ role: GrantRole; expiresAt: Date | null }>> {
    const grants = await this.prisma.access_grants.findMany({
      where: {
        user_id: params.userId,
        data_room_id: params.dataRoomId,
        revoked_at: null,
        AND: [activeExpiryWhere(), { OR: coveringTargetFilter(params) }],
      },
      select: { role: true, expires_at: true },
    });

    return grants.map((grant) => ({
      role: toGrantRole(grant.role),
      expiresAt: grant.expires_at,
    }));
  }

  async findCoveringGrantRoles(
    params: CoveringGrantQuery,
  ): Promise<GrantRole[]> {
    const grants = await this.findCoveringGrants(params);
    return grants.map((grant) => grant.role);
  }

  async hasCoveringAncestorGrant(params: {
    userId: string;
    dataRoomId: string;
    folderIds: string[];
  }): Promise<boolean> {
    const grant = await this.prisma.access_grants.findFirst({
      where: {
        user_id: params.userId,
        data_room_id: params.dataRoomId,
        revoked_at: null,
        AND: [activeExpiryWhere(), { OR: coveringTargetFilter(params) }],
      },
      select: { id: true },
    });

    return grant !== null;
  }

  async hasCoveringAncestorInvite(params: {
    email: string;
    dataRoomId: string;
    folderIds: string[];
  }): Promise<boolean> {
    const invite = await this.prisma.access_invitations.findFirst({
      where: {
        email: params.email,
        data_room_id: params.dataRoomId,
        ...pendingInviteStatusWhere(),
        AND: [{ OR: coveringTargetFilter(params) }],
      },
      select: { id: true },
    });

    return invite !== null;
  }

  async findCoveringPublicLink(
    params: CoveringPublicLinkQuery,
  ): Promise<{ id: string; expiresAt: Date | null } | null> {
    const now = new Date();
    const link = await this.prisma.public_share_links.findFirst({
      where: {
        token_hash: params.tokenHash,
        data_room_id: params.dataRoomId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        AND: [{ OR: coveringTargetFilter(params) }],
      },
      select: { id: true, expires_at: true },
    });

    return link ? { id: link.id, expiresAt: link.expires_at } : null;
  }

  async hasCoveringPublicLink(
    params: CoveringPublicLinkQuery,
  ): Promise<boolean> {
    return (await this.findCoveringPublicLink(params)) !== null;
  }

  async findAccessibleDataRoomIds(userId: string): Promise<string[]> {
    const [owned, granted] = await Promise.all([
      this.prisma.data_rooms.findMany({
        where: { owner_id: userId },
        select: { id: true },
      }),
      this.prisma.access_grants.findMany({
        where: { user_id: userId, ...activeGrantWhere() },
        distinct: ['data_room_id'],
        select: { data_room_id: true },
      }),
    ]);

    return [
      ...new Set([
        ...owned.map((room) => room.id),
        ...granted.map((grant) => grant.data_room_id),
      ]),
    ];
  }

  async findRoomLevelGrantedDataRoomIds(userId: string): Promise<string[]> {
    const grants = await this.prisma.access_grants.findMany({
      where: {
        user_id: userId,
        ...activeGrantWhere(),
        folder_id: null,
        file_id: null,
      },
      distinct: ['data_room_id'],
      select: { data_room_id: true },
    });

    return grants.map((grant) => grant.data_room_id);
  }

  async listActiveGrantsInRoom(
    userId: string,
    dataRoomId: string,
  ): Promise<RoomSearchGrantRecord[]> {
    const grants = await this.prisma.access_grants.findMany({
      where: {
        user_id: userId,
        data_room_id: dataRoomId,
        ...activeGrantWhere(),
      },
      select: {
        role: true,
        expires_at: true,
        folder_id: true,
        file_id: true,
        folder: { select: { path: true } },
      },
    });

    return grants.map((grant) => ({
      role: toGrantRole(grant.role),
      expiresAt: grant.expires_at,
      folderId: grant.folder_id,
      fileId: grant.file_id,
      folderPath: grant.folder?.path ?? null,
    }));
  }

  async findActivePublicLinkByTokenHash(
    tokenHash: string,
  ): Promise<ShareTargetRecord | null> {
    const now = new Date();
    const link = await this.prisma.public_share_links.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: PUBLIC_LINK_TARGET_SELECT,
    });

    return link
      ? { ...toTargetRecord(link), expiresAt: link.expires_at }
      : null;
  }

  async listIncomingGrants(userId: string): Promise<IncomingShareRecord[]> {
    const grants = await this.prisma.access_grants.findMany({
      where: {
        user_id: userId,
        ...activeGrantWhere(),
        data_room: { owner_id: { not: userId } },
      },
      select: {
        role: true,
        expires_at: true,
        data_room_id: true,
        folder_id: true,
        file_id: true,
        data_room: { select: { name: true } },
        folder: { select: { id: true, name: true } },
        file: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return grants.map((grant) => ({
      role: toGrantRole(grant.role),
      dataRoomId: grant.data_room_id,
      dataRoomName: grant.data_room.name,
      folder: grant.folder,
      file: grant.file,
      expiresAt: grant.expires_at,
    }));
  }

  async findSubject(
    type: AccessSubject['type'],
    id: string,
  ): Promise<AccessSubject | null> {
    if (type === 'data_room') {
      const room = await this.prisma.data_rooms.findUnique({
        where: { id },
        select: { id: true, owner_id: true },
      });

      if (!room) {
        return null;
      }

      return {
        type: 'data_room',
        id: room.id,
        dataRoomId: room.id,
        ownerId: room.owner_id,
        folderId: null,
        folderPath: null,
      };
    }

    if (type === 'folder') {
      const folder = await this.prisma.folders.findUnique({
        where: { id },
        select: {
          id: true,
          data_room_id: true,
          path: true,
          data_room: { select: { owner_id: true } },
        },
      });

      if (!folder) {
        return null;
      }

      return {
        type: 'folder',
        id: folder.id,
        dataRoomId: folder.data_room_id,
        ownerId: folder.data_room.owner_id,
        folderId: folder.id,
        folderPath: folder.path,
      };
    }

    const file = await this.prisma.files.findUnique({
      where: { id },
      select: {
        id: true,
        data_room_id: true,
        folder_id: true,
        data_room: { select: { owner_id: true } },
        folder: { select: { path: true } },
      },
    });

    if (!file) {
      return null;
    }

    return {
      type: 'file',
      id: file.id,
      dataRoomId: file.data_room_id,
      ownerId: file.data_room.owner_id,
      folderId: file.folder_id,
      folderPath: file.folder?.path ?? null,
    };
  }

  async findActiveUser(userId: string): Promise<AccessUserRecord | null> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      select: { id: true, email: true, name: true },
    });

    return user;
  }

  async findUserByEmail(email: string): Promise<AccessUserRecord | null> {
    const user = await this.prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    return user;
  }

  async findActiveGrant(params: {
    userId: string;
    dataRoomId: string;
    folderId: string | null;
    fileId: string | null;
  }): Promise<AccessGrantRecord | null> {
    const grant = await this.prisma.access_grants.findFirst({
      where: {
        user_id: params.userId,
        data_room_id: params.dataRoomId,
        folder_id: params.folderId,
        file_id: params.fileId,
        ...activeGrantWhere(),
      },
      select: GRANT_SELECT,
    });

    return grant ? toGrantRecord(grant) : null;
  }

  async findActiveGrantById(
    id: string,
  ): Promise<(ShareTargetRecord & { userId: string }) | null> {
    const grant = await this.prisma.access_grants.findFirst({
      where: { id, revoked_at: null },
      select: { ...TARGET_SELECT, user_id: true },
    });

    return grant ? { ...toTargetRecord(grant), userId: grant.user_id } : null;
  }

  async createGrant(
    params: {
      userId: string;
      grantedById: string;
      dataRoomId: string;
      folderId: string | null;
      fileId: string | null;
      role: GrantRole;
      expiresAt: Date | null;
    },
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<AccessGrantRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.access_grants.findFirst({
        where: {
          user_id: params.userId,
          data_room_id: params.dataRoomId,
          folder_id: params.folderId,
          file_id: params.fileId,
          revoked_at: null,
        },
        select: { id: true },
      });

      const grant = existing
        ? await tx.access_grants.update({
            where: { id: existing.id },
            data: {
              granted_by_id: params.grantedById,
              role: toPrismaRole(params.role),
              expires_at: params.expiresAt,
            },
            select: GRANT_SELECT,
          })
        : await tx.access_grants.create({
            data: {
              user_id: params.userId,
              granted_by_id: params.grantedById,
              data_room_id: params.dataRoomId,
              folder_id: params.folderId,
              file_id: params.fileId,
              role: toPrismaRole(params.role),
              expires_at: params.expiresAt,
            },
            select: GRANT_SELECT,
          });

      const record = toGrantRecord(grant);
      await after?.(tx);
      return record;
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async findPendingInvite(params: {
    email: string;
    dataRoomId: string;
    folderId: string | null;
    fileId: string | null;
  }): Promise<AccessInvitationRecord | null> {
    const invite = await this.prisma.access_invitations.findFirst({
      where: pendingInviteWhere(params),
      select: invitationSelect,
    });

    return invite ? toInvitationRecord(invite) : null;
  }

  async findPendingInviteByTokenHash(
    tokenHash: string,
  ): Promise<AccessInvitationRecord | null> {
    const invite = await this.prisma.access_invitations.findFirst({
      where: {
        token_hash: tokenHash,
        ...pendingInviteStatusWhere(),
      },
      select: invitationSelect,
    });

    return invite ? toInvitationRecord(invite) : null;
  }

  async findPendingInvitesByEmail(
    email: string,
  ): Promise<AccessInvitationRecord[]> {
    const invites = await this.prisma.access_invitations.findMany({
      where: {
        email,
        ...pendingInviteStatusWhere(),
      },
      select: invitationSelect,
    });

    return invites.map(toInvitationRecord);
  }

  async findPendingInviteById(id: string): Promise<ShareTargetRecord | null> {
    const invite = await this.prisma.access_invitations.findFirst({
      where: { id, ...pendingInviteStatusWhere() },
      select: TARGET_SELECT,
    });

    return invite ? toTargetRecord(invite) : null;
  }

  async createInvite(params: {
    email: string;
    grantedById: string;
    tokenHash: string;
    dataRoomId: string;
    folderId: string | null;
    fileId: string | null;
    role: GrantRole;
    expiresAt: Date;
    accessExpiresAt: Date | null;
  }): Promise<AccessInvitationRecord> {
    const invite = await this.prisma.access_invitations.create({
      data: {
        email: params.email,
        granted_by_id: params.grantedById,
        token_hash: params.tokenHash,
        data_room_id: params.dataRoomId,
        folder_id: params.folderId,
        file_id: params.fileId,
        role: toPrismaRole(params.role),
        expires_at: params.expiresAt,
        access_expires_at: params.accessExpiresAt,
      },
      select: invitationSelect,
    });

    return toInvitationRecord(invite);
  }

  async acceptInvitation(
    params: {
      invitationId: string;
      userId: string;
      grantedById: string;
      dataRoomId: string;
      folderId: string | null;
      fileId: string | null;
      role: GrantRole;
      expiresAt: Date | null;
    },
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.access_invitations.update({
        where: { id: params.invitationId },
        data: { accepted_at: new Date() },
      });

      const existing = await tx.access_grants.findFirst({
        where: {
          user_id: params.userId,
          data_room_id: params.dataRoomId,
          folder_id: params.folderId,
          file_id: params.fileId,
          revoked_at: null,
        },
        select: { id: true, role: true, expires_at: true },
      });

      if (existing) {
        const expired =
          existing.expires_at !== null &&
          existing.expires_at.getTime() <= Date.now();
        const nextRole = isGrantUpgrade(toGrantRole(existing.role), params.role)
          ? params.role
          : toGrantRole(existing.role);

        await tx.access_grants.update({
          where: { id: existing.id },
          data: {
            role: toPrismaRole(nextRole),
            expires_at: expired
              ? params.expiresAt
              : mergeStoredExpiry(existing.expires_at, params.expiresAt),
            ...(expired ? { granted_by_id: params.grantedById } : {}),
          },
        });
      } else {
        await tx.access_grants.create({
          data: {
            user_id: params.userId,
            granted_by_id: params.grantedById,
            data_room_id: params.dataRoomId,
            folder_id: params.folderId,
            file_id: params.fileId,
            role: toPrismaRole(params.role),
            expires_at: params.expiresAt,
          },
        });
      }

      await after?.(tx);
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async findActivePublicLink(
    target: AccessTarget,
  ): Promise<PublicShareLinkRecord | null> {
    const now = new Date();
    const link = await this.prisma.public_share_links.findFirst({
      where: {
        data_room_id: target.dataRoomId,
        folder_id: target.folderId,
        file_id: target.fileId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: publicLinkSelect,
    });

    return link ? toPublicLinkRecord(link) : null;
  }

  async findActivePublicLinkById(
    id: string,
  ): Promise<ShareTargetRecord | null> {
    const now = new Date();
    const link = await this.prisma.public_share_links.findFirst({
      where: {
        id,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: TARGET_SELECT,
    });

    return link ? toTargetRecord(link) : null;
  }

  async createPublicLink(
    params: {
      createdById: string;
      tokenHash: string;
      dataRoomId: string;
      folderId: string | null;
      fileId: string | null;
      expiresAt: Date | null;
    },
    after?: (tx: PrismaTx, record: PublicShareLinkRecord) => Promise<void>,
  ): Promise<PublicShareLinkRecord> {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.public_share_links.create({
        data: {
          created_by_id: params.createdById,
          token_hash: params.tokenHash,
          data_room_id: params.dataRoomId,
          folder_id: params.folderId,
          file_id: params.fileId,
          expires_at: params.expiresAt,
        },
        select: publicLinkSelect,
      });
      const record = toPublicLinkRecord(link);
      await after?.(tx, record);
      return record;
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async listGrantsForTarget(target: AccessTarget): Promise<ShareGrantRecord[]> {
    const grants = await this.prisma.access_grants.findMany({
      where: {
        data_room_id: target.dataRoomId,
        folder_id: target.folderId,
        file_id: target.fileId,
        ...activeGrantWhere(),
      },
      select: {
        id: true,
        role: true,
        expires_at: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return grants.map((grant) => ({
      id: grant.id,
      userId: grant.user.id,
      email: grant.user.email,
      name: grant.user.name,
      role: toGrantRole(grant.role),
      expiresAt: grant.expires_at,
    }));
  }

  async listPendingInvitesForTarget(
    target: AccessTarget,
  ): Promise<AccessInvitationRecord[]> {
    const invites = await this.prisma.access_invitations.findMany({
      where: {
        data_room_id: target.dataRoomId,
        folder_id: target.folderId,
        file_id: target.fileId,
        ...pendingInviteStatusWhere(),
      },
      select: invitationSelect,
      orderBy: { created_at: 'asc' },
    });

    return invites.map(toInvitationRecord);
  }

  async listTargetCoverage(params: {
    dataRoomId: string;
    folderIds: string[];
    fileIds: string[];
  }): Promise<TargetCoverageRecord[]> {
    const targetOr = coverageTargetFilter(params.folderIds, params.fileIds);
    const scoped = {
      data_room_id: params.dataRoomId,
      OR: targetOr,
    };

    return this.collectCoverage({
      grantsWhere: { ...scoped, ...activeGrantWhere() },
      invitesWhere: { ...scoped, ...pendingInviteStatusWhere() },
      linksWhere: {
        data_room_id: params.dataRoomId,
        ...activePublicLinkWhere(),
        AND: [{ OR: targetOr }],
      },
    });
  }

  async listOutgoingTargetStats(
    ownerId: string,
  ): Promise<TargetCoverageRecord[]> {
    const owned = { data_room: { owner_id: ownerId } };

    return this.collectCoverage({
      grantsWhere: { ...owned, ...activeGrantWhere() },
      invitesWhere: { ...owned, ...pendingInviteStatusWhere() },
      linksWhere: { ...owned, ...activePublicLinkWhere() },
    });
  }

  async findDataRooms(ids: string[]): Promise<DataRoomMetaRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.data_rooms.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async findFoldersMeta(ids: string[]): Promise<FolderMetaRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const folders = await this.prisma.folders.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        path: true,
        parent_id: true,
        data_room_id: true,
      },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      parentId: folder.parent_id,
      dataRoomId: folder.data_room_id,
    }));
  }

  async findFilesMeta(ids: string[]): Promise<FileMetaRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const files = await this.prisma.files.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        folder_id: true,
        data_room_id: true,
      },
    });

    return files.map((file) => ({
      id: file.id,
      name: file.name,
      folderId: file.folder_id,
      dataRoomId: file.data_room_id,
    }));
  }

  async revokeGrant(
    id: string,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<boolean> {
    return this.revokeRow(
      (tx) =>
        tx.access_grants.updateMany({
          where: { id, revoked_at: null },
          data: { revoked_at: new Date() },
        }),
      after,
    );
  }

  async revokeInvite(
    id: string,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<boolean> {
    return this.revokeRow(
      (tx) =>
        tx.access_invitations.updateMany({
          where: { id, revoked_at: null, accepted_at: null },
          data: { revoked_at: new Date() },
        }),
      after,
    );
  }

  async revokePublicLink(
    id: string,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<boolean> {
    return this.revokeRow(
      (tx) =>
        tx.public_share_links.updateMany({
          where: { id, revoked_at: null },
          data: { revoked_at: new Date() },
        }),
      after,
    );
  }

  private async revokeRow(
    update: (tx: PrismaTx) => Promise<{ count: number }>,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await update(tx);
      if (result.count === 0) {
        return false;
      }

      await after?.(tx);
      return true;
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  private async collectCoverage(params: {
    grantsWhere: Prisma.access_grantsWhereInput;
    invitesWhere: Prisma.access_invitationsWhereInput;
    linksWhere: Prisma.public_share_linksWhereInput;
  }): Promise<TargetCoverageRecord[]> {
    const [grantGroups, inviteGroups, linkGroups] = await Promise.all([
      this.prisma.access_grants.groupBy({
        by: ['data_room_id', 'folder_id', 'file_id'],
        where: params.grantsWhere,
        _count: { _all: true },
      }),
      this.prisma.access_invitations.groupBy({
        by: ['data_room_id', 'folder_id', 'file_id'],
        where: params.invitesWhere,
        _count: { _all: true },
      }),
      this.prisma.public_share_links.groupBy({
        by: ['data_room_id', 'folder_id', 'file_id'],
        where: params.linksWhere,
        _count: { _all: true },
      }),
    ]);

    return mergeTargetCoverage([
      ...grantGroups.map((row) => ({
        dataRoomId: row.data_room_id,
        folderId: row.folder_id,
        fileId: row.file_id,
        peopleCount: row._count._all,
      })),
      ...inviteGroups.map((row) => ({
        dataRoomId: row.data_room_id,
        folderId: row.folder_id,
        fileId: row.file_id,
        pendingCount: row._count._all,
      })),
      ...linkGroups.map((row) => ({
        dataRoomId: row.data_room_id,
        folderId: row.folder_id,
        fileId: row.file_id,
        hasPublicLink: row._count._all > 0,
      })),
    ]);
  }
}

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  granted_by_id: true,
  data_room_id: true,
  folder_id: true,
  file_id: true,
  expires_at: true,
  access_expires_at: true,
} as const;

const publicLinkSelect = {
  id: true,
  data_room_id: true,
  folder_id: true,
  file_id: true,
  expires_at: true,
} as const;

function activeExpiryWhere(): Prisma.access_grantsWhereInput {
  return {
    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
  };
}

function activeGrantWhere(): Prisma.access_grantsWhereInput {
  return {
    revoked_at: null,
    AND: [activeExpiryWhere()],
  };
}

function mergeStoredExpiry(
  current: Date | null,
  incoming: Date | null,
): Date | null {
  if (current === null || incoming === null) {
    return null;
  }

  return current.getTime() >= incoming.getTime() ? current : incoming;
}

function pendingInviteStatusWhere() {
  return {
    accepted_at: null,
    revoked_at: null,
    expires_at: { gt: new Date() },
  };
}

function pendingInviteWhere(params: {
  email: string;
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
}) {
  return {
    email: params.email,
    data_room_id: params.dataRoomId,
    folder_id: params.folderId,
    file_id: params.fileId,
    ...pendingInviteStatusWhere(),
  };
}

function toGrantRole(role: AccessRole): GrantRole {
  switch (role) {
    case AccessRole.EDITOR:
      return 'editor';
    case AccessRole.VIEWER:
      return 'viewer';
    default: {
      const unexpected: never = role;
      throw new Error('unexpected_access_role', { cause: unexpected });
    }
  }
}

function toPrismaRole(role: GrantRole): AccessRole {
  switch (role) {
    case 'editor':
      return AccessRole.EDITOR;
    case 'viewer':
      return AccessRole.VIEWER;
    default: {
      const unexpected: never = role;
      throw new Error('unexpected_grant_role', { cause: unexpected });
    }
  }
}

function toGrantRecord(grant: {
  id: string;
  user_id: string;
  role: AccessRole;
  data_room_id: string;
  folder_id: string | null;
  file_id: string | null;
  expires_at: Date | null;
}): AccessGrantRecord {
  return {
    id: grant.id,
    userId: grant.user_id,
    role: toGrantRole(grant.role),
    dataRoomId: grant.data_room_id,
    folderId: grant.folder_id,
    fileId: grant.file_id,
    expiresAt: grant.expires_at,
  };
}

function toInvitationRecord(invite: {
  id: string;
  email: string;
  role: AccessRole;
  granted_by_id: string;
  data_room_id: string;
  folder_id: string | null;
  file_id: string | null;
  expires_at: Date;
  access_expires_at: Date | null;
}): AccessInvitationRecord {
  return {
    id: invite.id,
    email: invite.email,
    role: toGrantRole(invite.role),
    grantedById: invite.granted_by_id,
    dataRoomId: invite.data_room_id,
    folderId: invite.folder_id,
    fileId: invite.file_id,
    expiresAt: invite.expires_at,
    accessExpiresAt: invite.access_expires_at,
  };
}

function toPublicLinkRecord(link: {
  id: string;
  data_room_id: string;
  folder_id: string | null;
  file_id: string | null;
  expires_at: Date | null;
}): PublicShareLinkRecord {
  return {
    id: link.id,
    dataRoomId: link.data_room_id,
    folderId: link.folder_id,
    fileId: link.file_id,
    expiresAt: link.expires_at,
  };
}

function toTargetRecord(record: {
  id: string;
  data_room_id: string;
  folder_id: string | null;
  file_id: string | null;
}): ShareTargetRecord {
  return {
    id: record.id,
    dataRoomId: record.data_room_id,
    folderId: record.folder_id,
    fileId: record.file_id,
  };
}

function coveringTargetFilter(params: CoveringAccessQuery) {
  return [
    { folder_id: null, file_id: null },
    ...(params.folderIds.length > 0
      ? [{ folder_id: { in: params.folderIds }, file_id: null }]
      : []),
    ...(params.fileId ? [{ file_id: params.fileId, folder_id: null }] : []),
  ];
}

function coverageTargetFilter(folderIds: string[], fileIds: string[]) {
  return [
    { folder_id: null, file_id: null },
    ...(folderIds.length > 0
      ? [{ folder_id: { in: folderIds }, file_id: null }]
      : []),
    ...(fileIds.length > 0 ? [{ file_id: { in: fileIds } }] : []),
  ];
}

function activePublicLinkWhere() {
  const now = new Date();
  return {
    revoked_at: null,
    OR: [{ expires_at: null }, { expires_at: { gt: now } }],
  };
}

function mergeTargetCoverage(
  rows: Array<{
    dataRoomId: string;
    folderId: string | null;
    fileId: string | null;
    peopleCount?: number;
    pendingCount?: number;
    hasPublicLink?: boolean;
  }>,
): TargetCoverageRecord[] {
  const byKey = new Map<string, TargetCoverageRecord>();

  for (const row of rows) {
    const key = `${row.dataRoomId}:${row.folderId ?? ''}:${row.fileId ?? ''}`;
    const current = byKey.get(key) ?? {
      dataRoomId: row.dataRoomId,
      folderId: row.folderId,
      fileId: row.fileId,
      peopleCount: 0,
      pendingCount: 0,
      hasPublicLink: false,
    };

    current.peopleCount += row.peopleCount ?? 0;
    current.pendingCount += row.pendingCount ?? 0;
    current.hasPublicLink = current.hasPublicLink || Boolean(row.hasPublicLink);
    byKey.set(key, current);
  }

  return [...byKey.values()];
}
