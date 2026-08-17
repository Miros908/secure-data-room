import { useQuery } from '@tanstack/react-query';
import type { ListOutgoingSharesResponse } from '@sdr/shared/access';
import { listOutgoingShares } from '@/app/api/list-outgoing-shares.fetcher';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useOutgoingShares(enabled = true) {
  return useQuery<ListOutgoingSharesResponse, ApiRequestError>({
    queryKey: accessQueryKeys.outgoing(),
    queryFn: listOutgoingShares,
    enabled,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      count < 2,
  });
}
