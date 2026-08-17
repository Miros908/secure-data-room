import type { Folder } from '@sdr/shared/folders';
import type { FolderRecord } from '../folders.types';

export function toFolderResponse(folder: FolderRecord): Folder {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    dataRoomId: folder.dataRoomId,
    createdAt: folder.createdAt.toISOString(),
  };
}
