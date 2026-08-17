import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RegisterDto, RegisterResponse } from '@sdr/shared/auth';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { confirmSession } from '@/app/api/confirm-session';
import { register } from '@/app/api/register.poster';
import { authQueryKeys } from '@/app/lib/auth.query-keys';

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<RegisterResponse, ApiRequestError, RegisterDto>({
    mutationFn: async (dto) => {
      await register(dto);
      return confirmSession('register_unconfirmed');
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.me(), user);
    },
  });
}
