import {
  folderContentsSchema,
  type FolderContents,
} from '@sdr/shared/folders';
import { apiClient } from '@/infrastructure/http/api-client';

export type ListFolderContentsParams = {
  dataRoomId?: string;
  folderId?: string;
  token?: string;
};

export async function listFolderContents(
  params: ListFolderContentsParams,
): Promise<FolderContents> {
  const query = params.token ? { token: params.token } : undefined;

  if (params.folderId) {
    const response = await apiClient.get(`/folders/${params.folderId}`, {
      params: query,
    });
    return folderContentsSchema.parse(response.data);
  }

  const response = await apiClient.get('/folders', {
    params: { dataRoomId: params.dataRoomId, ...query },
  });
  return folderContentsSchema.parse(response.data);
}
