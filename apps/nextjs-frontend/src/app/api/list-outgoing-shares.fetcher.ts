import {
  listOutgoingSharesResponseSchema,
  type ListOutgoingSharesResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function listOutgoingShares(): Promise<ListOutgoingSharesResponse> {
  const response = await apiClient.get('/access/outgoing');
  return listOutgoingSharesResponseSchema.parse(response.data);
}
