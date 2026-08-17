import { useQuery } from '@tanstack/react-query';
import type { ResolvePublicLinkResponse } from '@sdr/shared/access';
import { resolvePublicLink } from '@/app/api/resolve-public-link.fetcher';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function usePublicLink(token: string | undefined) {
  return useQuery<ResolvePublicLinkResponse, ApiRequestError>({
    queryKey: accessQueryKeys.publicLink(token ?? ''),
    queryFn: () => {
      if (!token) {
        throw new Error('token_required');
      }

      return resolvePublicLink({ token });
    },
    enabled: Boolean(token),
    retry: false,
  });
}
