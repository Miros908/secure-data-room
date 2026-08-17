import {
  shareByEmailResponseSchema,
  type ShareByEmailDto,
  type ShareByEmailResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function shareByEmail(
  dto: ShareByEmailDto,
): Promise<ShareByEmailResponse> {
  const response = await apiClient.post('/access/people', dto);
  return shareByEmailResponseSchema.parse(response.data);
}
