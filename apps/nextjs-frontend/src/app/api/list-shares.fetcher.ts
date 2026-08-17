import {
  listSharesResponseSchema,
  type ListSharesDto,
  type ListSharesResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function listShares(
  query: ListSharesDto,
): Promise<ListSharesResponse> {
  const response = await apiClient.get('/access/shares', { params: query });
  return listSharesResponseSchema.parse(response.data);
}
