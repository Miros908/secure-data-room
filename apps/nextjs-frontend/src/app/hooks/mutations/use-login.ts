import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginDto, LoginResponse } from '@sdr/shared/auth';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { confirmSession } from '@/app/api/confirm-session';
import { login } from '@/app/api/login.poster';
import { authQueryKeys } from '@/app/lib/auth.query-keys';

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, ApiRequestError, LoginDto>({
    mutationFn: async (dto) => {
      await login(dto);
      return confirmSession();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.me(), user);
    },
  });
}
