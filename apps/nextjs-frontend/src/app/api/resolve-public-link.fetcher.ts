import {
  resolvePublicLinkResponseSchema,
  type ResolvePublicLinkDto,
  type ResolvePublicLinkResponse,
} from '@sdr/shared/access';
import { apiClient } from '@/infrastructure/http/api-client';

export async function resolvePublicLink(
  query: ResolvePublicLinkDto,
): Promise<ResolvePublicLinkResponse> {
  const response = await apiClient.get('/access/public-links/resolve', {
    params: query,
  });
  return resolvePublicLinkResponseSchema.parse(response.data);
}
