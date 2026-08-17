import { Injectable } from '@nestjs/common';
import type { ListOutgoingSharesResponse } from '@sdr/shared/access';
import { parseFolderPath } from '../utils/folder-path';
import { AccessRepository } from '../access.repository';
import type {
  FileMetaRecord,
  FolderMetaRecord,
  TargetCoverageRecord,
} from '../access.repository';

export type ListOutgoingSharesInput = {
  ownerId: string;
};

@Injectable()
export class ListOutgoingSharesService {
  constructor(private readonly accessRepository: AccessRepository) {}

  async execute(
    input: ListOutgoingSharesInput,
  ): Promise<ListOutgoingSharesResponse> {
    const stats = await this.accessRepository.listOutgoingTargetStats(
      input.ownerId,
    );

    if (stats.length === 0) {
      return { items: [] };
    }

    const roomIds = [...new Set(stats.map((row) => row.dataRoomId))];
    const fileIds = stats.flatMap((row) => (row.fileId ? [row.fileId] : []));
    const folderIdsFromStats = stats.flatMap((row) =>
      row.folderId && !row.fileId ? [row.folderId] : [],
    );

    const [rooms, files] = await Promise.all([
      this.accessRepository.findDataRooms(roomIds),
      this.accessRepository.findFilesMeta(fileIds),
    ]);

    const parentFolderIds = files.flatMap((file) =>
      file.folderId ? [file.folderId] : [],
    );
    const folders = await this.accessRepository.findFoldersMeta([
      ...new Set([...folderIdsFromStats, ...parentFolderIds]),
    ]);

    const pathFolderIds = [
      ...new Set(
        folders.flatMap((folder) => [
          ...parseFolderPath(folder.path),
          ...(folder.parentId ? [folder.parentId] : []),
        ]),
      ),
    ];
    const pathFolders = await this.accessRepository.findFoldersMeta(
      pathFolderIds.filter((id) => !folders.some((folder) => folder.id === id)),
    );

    const roomName = new Map(rooms.map((room) => [room.id, room.name]));
    const folderById = new Map(
      [...folders, ...pathFolders].map((folder) => [folder.id, folder]),
    );
    const fileById = new Map(files.map((file) => [file.id, file]));

    const items = stats.flatMap((row) => {
      const item = toOutgoingItem(row, {
        roomName,
        folderById,
        fileById,
      });
      return item ? [item] : [];
    });

    items.sort((left, right) =>
      left.name.localeCompare(right.name, 'ru', {
        numeric: true,
        sensitivity: 'base',
      }),
    );

    return { items };
  }
}

function toOutgoingItem(
  row: TargetCoverageRecord,
  lookup: {
    roomName: Map<string, string>;
    folderById: Map<string, FolderMetaRecord>;
    fileById: Map<string, FileMetaRecord>;
  },
): ListOutgoingSharesResponse['items'][number] | null {
  if (row.fileId) {
    const file = lookup.fileById.get(row.fileId);
    if (!file) {
      return null;
    }

    const parent = file.folderId
      ? lookup.folderById.get(file.folderId)
      : undefined;

    return {
      type: 'file',
      id: file.id,
      name: file.name,
      dataRoomId: file.dataRoomId,
      parentFolderId: file.folderId,
      path: folderPathItems(parent, lookup.folderById),
      peopleCount: row.peopleCount,
      pendingCount: row.pendingCount,
      hasPublicLink: row.hasPublicLink,
    };
  }

  if (row.folderId) {
    const folder = lookup.folderById.get(row.folderId);
    if (!folder) {
      return null;
    }

    return {
      type: 'folder',
      id: folder.id,
      name: folder.name,
      dataRoomId: folder.dataRoomId,
      parentFolderId: folder.parentId,
      path: ancestorPathItems(folder.path, lookup.folderById),
      peopleCount: row.peopleCount,
      pendingCount: row.pendingCount,
      hasPublicLink: row.hasPublicLink,
    };
  }

  const name = lookup.roomName.get(row.dataRoomId);
  if (!name) {
    return null;
  }

  return {
    type: 'data_room',
    id: row.dataRoomId,
    name,
    dataRoomId: row.dataRoomId,
    parentFolderId: null,
    path: [],
    peopleCount: row.peopleCount,
    pendingCount: row.pendingCount,
    hasPublicLink: row.hasPublicLink,
  };
}

function ancestorPathItems(
  path: string,
  folderById: Map<string, FolderMetaRecord>,
): Array<{ id: string; name: string }> {
  return parseFolderPath(path).flatMap((id) => {
    const folder = folderById.get(id);
    return folder ? [{ id: folder.id, name: folder.name }] : [];
  });
}

function folderPathItems(
  folder: FolderMetaRecord | undefined,
  folderById: Map<string, FolderMetaRecord>,
): Array<{ id: string; name: string }> {
  if (!folder) {
    return [];
  }

  return [
    ...ancestorPathItems(folder.path, folderById),
    { id: folder.id, name: folder.name },
  ];
}
