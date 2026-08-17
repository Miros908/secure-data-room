import {
  listIncomingSharesResponseSchema,
  type ListIncomingSharesResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function listIncomingShares(): Promise<ListIncomingSharesResponse> {
  const response = await apiClient.get('/access/incoming');
  return listIncomingSharesResponseSchema.parse(response.data);
}
