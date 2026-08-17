import { logoutResponseSchema, type LogoutResponse } from '@sdr/shared/auth';
import { apiClient } from '@/infrastructure/http/api-client';

export async function logout(): Promise<LogoutResponse> {
  const response = await apiClient.post('/auth/logout');
  return logoutResponseSchema.parse(response.data);
}
