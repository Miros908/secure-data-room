import {
  recordFileViewResponseSchema,
  type RecordFileViewResponse,
} from '@sdr/shared/activity';
import { apiClient } from '@/infrastructure/http/api-client';

export async function recordFileView(
  id: string,
  token?: string,
): Promise<RecordFileViewResponse> {
  const response = await apiClient.post(`/files/${id}/view`, {}, {
    params: token ? { token } : undefined,
  });
  return recordFileViewResponseSchema.parse(response.data);
}
