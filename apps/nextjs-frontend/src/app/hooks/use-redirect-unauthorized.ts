import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authQueryKeys } from '@/app/lib/auth.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useRedirectUnauthorized(error: ApiRequestError | null | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (error?.statusCode === 401) {
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      router.replace('/login');
    }
  }, [error, queryClient, router]);
}
