import {
  deleteFolderResponseSchema,
  type DeleteFolderResponse,
} from '@sdr/shared/folders';
import { apiClient } from '@/infrastructure/http/api-client';

export async function deleteFolder(id: string): Promise<DeleteFolderResponse> {
  const response = await apiClient.delete(`/folders/${id}`);
  return deleteFolderResponseSchema.parse(response.data);
}
