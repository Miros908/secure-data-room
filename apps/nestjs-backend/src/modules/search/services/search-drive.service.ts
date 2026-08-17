import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  SearchDriveQuery,
  SearchDriveResponse,
  SearchHit,
} from '@sdr/shared/search';
import { AccessRepository } from '../../access/access.repository';
import type { EffectiveRole } from '../../access/access.constants';
import { parseFolderPath } from '../../access/utils/folder-path';
import { hashShareToken } from '../../access/utils/share-token';
import {
  mergeAccessExpiry,
  toIsoOrNull,
} from '../../access/utils/access-expiry';
import { maxRole, toVisibleRole } from '../../access/utils/resolve-access';
import { SEARCH_PAGE_SIZE } from '../search.constants';
import { SearchRepository } from '../search.repository';
import type { SearchHitRow } from '../search.types';
import { decodeSearchCursor, encodeSearchCursor } from '../utils/search-cursor';
import {
  fileParentIsVisible,
  folderIsVisible,
  mergeSearchScopes,
  type SearchScope,
  type SearchVisibility,
} from '../utils/search-visibility';

export type SearchDriveInput = SearchDriveQuery & {
  userId?: string | null;
};

@Injectable()
export class SearchDriveService {
  constructor(
    private readonly searchRepository: SearchRepository,
    private readonly accessRepository: AccessRepository,
  ) {}

  async execute(input: SearchDriveInput): Promise<SearchDriveResponse> {
    const scope = await this.resolveScope(input.userId ?? null, input);

    if (!scope) {
      throw new NotFoundException('not_found');
    }

    const decoded = input.cursor ? decodeSearchCursor(input.cursor) : null;
    if (input.cursor && !decoded) {
      return this.toResponse(input.q, input.dataRoomId, scope, [], null);
    }

    const take = (input.limit ?? SEARCH_PAGE_SIZE) + 1;
    const rows = await this.searchRepository.searchHits({
      dataRoomId: input.dataRoomId,
      query: input.q,
      visibility: scope.visibility,
      cursor: decoded,
      take,
    });
    const page = rows.slice(0, take - 1);
    const last = page.at(-1);
    const nextCursor =
      rows.length === take && last
        ? encodeSearchCursor({
            name: last.name,
            kind: last.kind,
            id: last.id,
          })
        : null;

    return this.toResponse(
      input.q,
      input.dataRoomId,
      scope,
      await this.toHits(page, scope.visibility),
      nextCursor,
    );
  }

  private async resolveScope(
    userId: string | null,
    input: { dataRoomId: string; token?: string },
  ): Promise<SearchScope | null> {
    const room = await this.accessRepository.findSubject(
      'data_room',
      input.dataRoomId,
    );

    if (!room) {
      return null;
    }

    return mergeSearchScopes(
      await this.sessionScope(userId, room.ownerId, room.dataRoomId),
      await this.tokenScope(input.token, room.dataRoomId),
    );
  }

  private async sessionScope(
    userId: string | null,
    ownerId: string,
    dataRoomId: string,
  ): Promise<SearchScope | null> {
    if (!userId) {
      return null;
    }

    if (userId === ownerId) {
      return {
        role: 'owner',
        accessExpiresAt: null,
        visibility: { type: 'room' },
      };
    }

    const grants = await this.accessRepository.listActiveGrantsInRoom(
      userId,
      dataRoomId,
    );

    if (grants.length === 0) {
      return null;
    }

    const role = grants.reduce<EffectiveRole>(
      (highest, grant) => maxRole(highest, grant.role),
      'none',
    );

    if (role === 'none') {
      return null;
    }

    const roomLevel = grants.some(
      (grant) => grant.folderId === null && grant.fileId === null,
    );
    const visibility: SearchVisibility = roomLevel
      ? { type: 'room' }
      : {
          type: 'restricted',
          folderPaths: grants.flatMap((grant) =>
            grant.folderPath ? [grant.folderPath] : [],
          ),
          fileIds: grants.flatMap((grant) =>
            grant.fileId ? [grant.fileId] : [],
          ),
        };

    return {
      role,
      accessExpiresAt: mergeAccessExpiry(
        grants.map((grant) => grant.expiresAt),
      ),
      visibility,
    };
  }

  private async tokenScope(
    token: string | undefined,
    dataRoomId: string,
  ): Promise<SearchScope | null> {
    if (!token) {
      return null;
    }

    const link = await this.accessRepository.findActivePublicLinkByTokenHash(
      hashShareToken(token),
    );

    if (!link || link.dataRoomId !== dataRoomId) {
      return null;
    }

    if (!link.folderId && !link.fileId) {
      return {
        role: 'viewer',
        accessExpiresAt: link.expiresAt ?? null,
        visibility: { type: 'room' },
      };
    }

    if (link.fileId) {
      return {
        role: 'viewer',
        accessExpiresAt: link.expiresAt ?? null,
        visibility: {
          type: 'restricted',
          folderPaths: [],
          fileIds: [link.fileId],
        },
      };
    }

    const folders = await this.accessRepository.findFoldersMeta([
      link.folderId as string,
    ]);
    const folder = folders[0];

    if (!folder) {
      return null;
    }

    return {
      role: 'viewer',
      accessExpiresAt: link.expiresAt ?? null,
      visibility: {
        type: 'restricted',
        folderPaths: [folder.path],
        fileIds: [],
      },
    };
  }

  private async toHits(
    rows: SearchHitRow[],
    visibility: SearchVisibility,
  ): Promise<SearchHit[]> {
    const ancestorIds = [
      ...new Set(
        rows.flatMap((row) =>
          visibleAncestorIds(row, visibility).filter((id) => id !== row.id),
        ),
      ),
    ];
    const folders = await this.accessRepository.findFoldersMeta(ancestorIds);
    const names = new Map(folders.map((folder) => [folder.id, folder.name]));

    return rows.map((row) => toHit(row, visibility, names));
  }

  private toResponse(
    q: string,
    dataRoomId: string,
    scope: SearchScope,
    items: SearchHit[],
    nextCursor: string | null,
  ): SearchDriveResponse {
    return {
      q,
      dataRoomId,
      role: toVisibleRole(scope.role),
      accessExpiresAt: toIsoOrNull(scope.accessExpiresAt),
      items,
      nextCursor,
    };
  }
}

function visibleAncestorIds(
  row: SearchHitRow,
  visibility: SearchVisibility,
): string[] {
  return parseFolderPath(row.folder_path).filter((id) => {
    const folder = { id, path: ancestorPath(row.folder_path, id) };
    if (!folder.path) {
      return false;
    }
    return folderIsVisible(folder.path, visibility);
  });
}

function ancestorPath(
  fullPath: string | null,
  folderId: string,
): string | null {
  if (!fullPath) {
    return null;
  }

  const marker = `/${folderId}/`;
  const index = fullPath.indexOf(marker);
  if (index < 0) {
    return null;
  }

  return fullPath.slice(0, index + marker.length);
}

function toHit(
  row: SearchHitRow,
  visibility: SearchVisibility,
  names: Map<string, string>,
): SearchHit {
  const ancestorIds = visibleAncestorIds(row, visibility).filter(
    (id) => id !== row.id,
  );
  const breadcrumbs = ancestorIds.flatMap((id) => {
    const name = names.get(id);
    return name ? [{ id, name }] : [];
  });
  const parentVisible =
    row.kind === 'folder'
      ? Boolean(row.parent_id) && ancestorIds.includes(row.parent_id as string)
      : fileParentIsVisible(row.folder_path, visibility);

  if (row.kind === 'folder') {
    return {
      kind: 'folder',
      id: row.id,
      name: row.name,
      parentId: parentVisible ? row.parent_id : null,
      createdAt: row.created_at.toISOString(),
      breadcrumbs,
    };
  }

  return {
    kind: 'file',
    id: row.id,
    name: row.name,
    parentId: parentVisible ? row.parent_id : null,
    createdAt: row.created_at.toISOString(),
    breadcrumbs,
    mimeType: row.mime_type ?? 'application/pdf',
    sizeBytes: Number(row.size_bytes ?? 0),
    versionCount: Math.max(1, Number(row.version_count ?? 1)),
  };
}
