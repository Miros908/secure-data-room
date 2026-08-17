import { fileDetailSchema, type FileDetail } from '@sdr/shared/files';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getFile(id: string, token?: string): Promise<FileDetail> {
  const response = await apiClient.get(`/files/${id}`, {
    params: token ? { token } : undefined,
  });
  return fileDetailSchema.parse(response.data);
}
