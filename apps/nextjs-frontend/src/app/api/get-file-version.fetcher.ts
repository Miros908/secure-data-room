import { fileDetailSchema, type FileDetail } from '@sdr/shared/files';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getFileVersion(
  fileId: string,
  versionId: string,
  token?: string,
): Promise<FileDetail> {
  const response = await apiClient.get(
    `/files/${fileId}/versions/${versionId}`,
    {
      params: token ? { token } : undefined,
    },
  );
  return fileDetailSchema.parse(response.data);
}
