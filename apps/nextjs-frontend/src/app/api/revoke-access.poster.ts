import {
  revokeAccessResponseSchema,
  type RevokeAccessDto,
  type RevokeAccessResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function revokeAccess(
  dto: RevokeAccessDto,
): Promise<RevokeAccessResponse> {
  const response = await apiClient.post('/access/revoke', dto);
  return revokeAccessResponseSchema.parse(response.data);
}
