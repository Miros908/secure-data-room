import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SharingSummary } from '@sdr/shared/access';
import type { FolderContents } from '@sdr/shared/folders';
import { AccessRepository } from '../../access/access.repository';
import { ResolveService } from '../../access/services/resolve.service';
import { parseFolderPath } from '../../access/utils/folder-path';
import { toVisibleRole } from '../../access/utils/resolve-access';
import { toIsoOrNull } from '../../access/utils/access-expiry';
import {
  childAncestorChain,
  inheritedAncestorChain,
  inheritedFolderIds,
  nearestCoveringSource,
  shareTargetKey,
  toSharingSummary,
} from '../../access/utils/sharing-coverage';
import { FoldersRepository } from '../folders.repository';
import type {
  FileChildRecord,
  FolderChildRecord,
  FolderRecord,
} from '../folders.types';
import { toFolderResponse } from '../utils/to-folder-response';

export type ListFolderContentsInput = {
  userId?: string | null;
  token?: string | null;
  dataRoomId?: string;
  folderId?: string;
};

@Injectable()
export class ListFolderContentsService {
  constructor(
    private readonly foldersRepository: FoldersRepository,
    private readonly resolveService: ResolveService,
    private readonly accessRepository: AccessRepository,
  ) {}

  async execute(input: ListFolderContentsInput): Promise<FolderContents> {
    if (input.folderId) {
      return this.listFolder(input.folderId, input);
    }

    if (!input.dataRoomId) {
      throw new BadRequestException('parent_or_data_room_required');
    }

    return this.listRoot(input.dataRoomId, input);
  }

  private async listRoot(
    dataRoomId: string,
    access: { userId?: string | null; token?: string | null },
  ): Promise<FolderContents> {
    const { subject, role, accessExpiresAt } =
      await this.resolveService.requireReadableSubject(
        'data_room',
        dataRoomId,
        access,
      );

    const [folders, files] = await Promise.all([
      this.foldersRepository.listChildFolders({
        dataRoomId: subject.id,
        parentId: null,
      }),
      this.foldersRepository.listChildFiles({
        dataRoomId: subject.id,
        folderId: null,
      }),
    ]);

    return this.toContents({
      folder: null,
      dataRoomId: subject.id,
      role: toVisibleRole(role),
      accessExpiresAt,
      breadcrumbs: [],
      folders,
      files,
    });
  }

  private async listFolder(
    folderId: string,
    access: { userId?: string | null; token?: string | null },
  ): Promise<FolderContents> {
    const { subject, role, accessExpiresAt } =
      await this.resolveService.requireReadableSubject(
        'folder',
        folderId,
        access,
      );
    const folder = await this.foldersRepository.findById(subject.id);

    if (!folder) {
      throw new NotFoundException('not_found');
    }

    const [folders, files, breadcrumbs] = await Promise.all([
      this.foldersRepository.listChildFolders({
        dataRoomId: folder.dataRoomId,
        parentId: folder.id,
      }),
      this.foldersRepository.listChildFiles({
        dataRoomId: folder.dataRoomId,
        folderId: folder.id,
      }),
      this.breadcrumbs(folder, access),
    ]);

    return this.toContents({
      folder,
      dataRoomId: folder.dataRoomId,
      role: toVisibleRole(role),
      accessExpiresAt,
      breadcrumbs,
      folders,
      files,
    });
  }

  private async toContents(input: {
    folder: FolderRecord | null;
    dataRoomId: string;
    role: FolderContents['role'];
    accessExpiresAt: Date | null | undefined;
    breadcrumbs: FolderContents['breadcrumbs'];
    folders: FolderChildRecord[];
    files: FileChildRecord[];
  }): Promise<FolderContents> {
    const sharing = await this.listingSharing(input);

    return {
      folder: input.folder ? toFolderResponse(input.folder) : null,
      dataRoomId: input.dataRoomId,
      role: input.role,
      accessExpiresAt: toIsoOrNull(input.accessExpiresAt),
      breadcrumbs: input.breadcrumbs,
      folders: input.folders.map((folder) => ({
        ...toChild(folder),
        sharing: sharing?.folders.get(folder.id),
      })),
      files: input.files.map((file) => ({
        ...toFileChild(file),
        sharing: sharing?.files.get(file.id),
      })),
      sharing: sharing?.current,
    };
  }

  private async listingSharing(input: {
    folder: FolderRecord | null;
    dataRoomId: string;
    role: FolderContents['role'];
    folders: FolderChildRecord[];
    files: FileChildRecord[];
  }): Promise<{
    current: SharingSummary;
    folders: Map<string, SharingSummary>;
    files: Map<string, SharingSummary>;
  } | null> {
    if (input.role !== 'owner') {
      return null;
    }

    const ancestorIds = input.folder
      ? inheritedFolderIds({
          type: 'folder',
          folderId: input.folder.id,
          folderPath: input.folder.path,
        })
      : [];
    const coverageFolderIds = [
      ...new Set([
        ...ancestorIds,
        ...(input.folder ? [input.folder.id] : []),
        ...input.folders.map((folder) => folder.id),
      ]),
    ];
    const [rooms, ancestorFolders, coverageRows] = await Promise.all([
      this.accessRepository.findDataRooms([input.dataRoomId]),
      this.accessRepository.findFoldersMeta(ancestorIds),
      this.accessRepository.listTargetCoverage({
        dataRoomId: input.dataRoomId,
        folderIds: coverageFolderIds,
        fileIds: input.files.map((file) => file.id),
      }),
    ]);
    const dataRoomName = rooms[0]?.name ?? 'Мой диск';
    const ancestorName = new Map(
      ancestorFolders.map((folder) => [folder.id, folder.name]),
    );
    const ancestorFoldersRootToLeaf = ancestorIds.flatMap((id) => {
      const name = ancestorName.get(id);
      return name ? [{ id, name }] : [];
    });
    const coverageByKey = new Map(
      coverageRows.map((row) => [
        shareTargetKey(row),
        {
          peopleCount: row.peopleCount,
          pendingCount: row.pendingCount,
          hasPublicLink: row.hasPublicLink,
        },
      ]),
    );
    const inheritedChain = input.folder
      ? inheritedAncestorChain({
          dataRoomId: input.dataRoomId,
          dataRoomName,
          ancestorFolders: ancestorFoldersRootToLeaf,
        })
      : [];
    const childChain = childAncestorChain({
      dataRoomId: input.dataRoomId,
      dataRoomName,
      currentFolder: input.folder
        ? { id: input.folder.id, name: input.folder.name }
        : null,
      ancestorFolders: ancestorFoldersRootToLeaf,
    });
    const currentKey = shareTargetKey({
      dataRoomId: input.dataRoomId,
      folderId: input.folder?.id ?? null,
      fileId: null,
    });

    return {
      current: toSharingSummary(
        coverageByKey.get(currentKey),
        nearestCoveringSource(inheritedChain, coverageByKey),
      ),
      folders: new Map(
        input.folders.map((folder) => [
          folder.id,
          toSharingSummary(
            coverageByKey.get(
              shareTargetKey({
                dataRoomId: input.dataRoomId,
                folderId: folder.id,
                fileId: null,
              }),
            ),
            nearestCoveringSource(childChain, coverageByKey),
          ),
        ]),
      ),
      files: new Map(
        input.files.map((file) => [
          file.id,
          toSharingSummary(
            coverageByKey.get(
              shareTargetKey({
                dataRoomId: input.dataRoomId,
                folderId: null,
                fileId: file.id,
              }),
            ),
            nearestCoveringSource(childChain, coverageByKey),
          ),
        ]),
      ),
    };
  }

  private async breadcrumbs(
    folder: FolderRecord,
    access: { userId?: string | null; token?: string | null },
  ): Promise<Array<{ id: string; name: string }>> {
    const ids = parseFolderPath(folder.path);
    const ancestors = await this.foldersRepository.findManyByIds(ids);
    const byId = new Map(ancestors.map((item) => [item.id, item]));
    const crumbs: Array<{ id: string; name: string }> = [];

    for (const id of ids) {
      const ancestor = byId.get(id);

      if (!ancestor) {
        continue;
      }

      const role = await this.resolveService.execute({
        userId: access.userId,
        token: access.token,
        subject: {
          type: 'folder',
          id: ancestor.id,
          dataRoomId: ancestor.dataRoomId,
          ownerId: ancestor.ownerId,
          folderId: ancestor.id,
          folderPath: ancestor.path,
        },
      });

      if (role === 'none') {
        continue;
      }

      crumbs.push({ id: ancestor.id, name: ancestor.name });
    }

    return crumbs;
  }
}

function toChild(item: { id: string; name: string; createdAt: Date }) {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt.toISOString(),
  };
}

function toFileChild(item: {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  versionCount: number;
  createdAt: Date;
}) {
  return {
    ...toChild(item),
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    versionCount: item.versionCount,
  };
}
