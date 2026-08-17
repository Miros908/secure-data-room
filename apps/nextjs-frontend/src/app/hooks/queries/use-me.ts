import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@sdr/shared/auth';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { getMe } from '@/app/api/get-me.fetcher';
import { authQueryKeys } from '@/app/lib/auth.query-keys';

export function useMe() {
  return useQuery<MeResponse, ApiRequestError>({
    queryKey: authQueryKeys.me(),
    queryFn: getMe,
    retry: (count, error) => error.statusCode !== 401 && count < 2,
  });
}
