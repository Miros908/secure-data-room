import { folderSchema, type CreateFolderDto, type Folder } from '@sdr/shared/folders';
import { apiClient } from '@/infrastructure/http/api-client';

export async function createFolder(dto: CreateFolderDto): Promise<Folder> {
  const response = await apiClient.post('/folders', dto);
  return folderSchema.parse(response.data);
}
