import {
  folderSchema,
  type Folder,
  type RenameFolderDto,
} from '@sdr/shared/folders';
import { apiClient } from '@/infrastructure/http/api-client';

export async function renameFolder(
  id: string,
  dto: RenameFolderDto,
): Promise<Folder> {
  const response = await apiClient.patch(`/folders/${id}`, dto);
  return folderSchema.parse(response.data);
}
