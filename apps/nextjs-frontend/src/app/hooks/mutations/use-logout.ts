import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LogoutResponse } from '@sdr/shared/auth';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { logout } from '@/app/api/logout.poster';

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, ApiRequestError, void>({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
