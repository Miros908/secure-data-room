import {
  loginResponseSchema,
  type LoginDto,
  type LoginResponse,
} from '@sdr/shared/auth';
import { apiClient } from '@/infrastructure/http/api-client';

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const response = await apiClient.post('/auth/login', dto);
  return loginResponseSchema.parse(response.data);
}
