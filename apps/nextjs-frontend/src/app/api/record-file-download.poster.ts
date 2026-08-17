import {
  recordFileDownloadResponseSchema,
  type RecordFileDownloadResponse,
} from '@sdr/shared/activity';
import { apiClient } from '@/infrastructure/http/api-client';

export async function recordFileDownload(input: {
  id: string;
  token?: string;
  versionId?: string;
}): Promise<RecordFileDownloadResponse> {
  const response = await apiClient.post(
    `/files/${input.id}/download`,
    {},
    {
      params: {
        ...(input.token ? { token: input.token } : {}),
        ...(input.versionId ? { versionId: input.versionId } : {}),
      },
    },
  );
  return recordFileDownloadResponseSchema.parse(response.data);
}
