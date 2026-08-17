import {
  registerResponseSchema,
  type RegisterDto,
  type RegisterResponse,
} from '@sdr/shared/auth';
import { apiClient } from '@/infrastructure/http/api-client';

export async function register(dto: RegisterDto): Promise<RegisterResponse> {
  const response = await apiClient.post('/auth/register', dto);
  return registerResponseSchema.parse(response.data);
}
