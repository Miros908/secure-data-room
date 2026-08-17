import { useQuery } from '@tanstack/react-query';
import type { ListIncomingSharesResponse } from '@sdr/shared/access';
import { listIncomingShares } from '@/app/api/list-incoming-shares.fetcher';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useIncomingShares() {
  return useQuery<ListIncomingSharesResponse, ApiRequestError>({
    queryKey: accessQueryKeys.incoming(),
    queryFn: listIncomingShares,
  });
}
