import { meResponseSchema, type MeResponse } from '@sdr/shared/auth';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getMe(): Promise<MeResponse> {
  const response = await apiClient.get('/auth/me');
  return meResponseSchema.parse(response.data);
}
