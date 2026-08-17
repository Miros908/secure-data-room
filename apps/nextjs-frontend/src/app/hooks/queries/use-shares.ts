import { useQuery } from '@tanstack/react-query';
import type {
  AccessSubjectType,
  ListSharesResponse,
} from '@sdr/shared/access';
import { listShares } from '@/app/api/list-shares.fetcher';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useShares(input: {
  type: AccessSubjectType;
  id: string;
  enabled?: boolean;
}) {
  return useQuery<ListSharesResponse, ApiRequestError>({
    queryKey: accessQueryKeys.shares({ type: input.type, id: input.id }),
    queryFn: () => listShares({ type: input.type, id: input.id }),
    enabled: input.enabled ?? true,
  });
}
