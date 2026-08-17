import { fileVersionListSchema, type FileVersionList } from '@sdr/shared/files';
import { apiClient } from '@/infrastructure/http/api-client';

export async function listFileVersions(
  id: string,
  token?: string,
): Promise<FileVersionList> {
  const response = await apiClient.get(`/files/${id}/versions`, {
    params: token ? { token } : undefined,
  });
  return fileVersionListSchema.parse(response.data);
}
