import {
  createPublicLinkResponseSchema,
  type CreatePublicLinkDto,
  type CreatePublicLinkResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function createPublicLink(
  dto: CreatePublicLinkDto,
): Promise<CreatePublicLinkResponse> {
  const response = await apiClient.post('/access/public-links', dto);
  return createPublicLinkResponseSchema.parse(response.data);
}
