import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RevokeAccessDto,
  RevokeAccessResponse,
} from '@sdr/shared/access';
import { revokeAccess } from '@/app/api/revoke-access.poster';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation<RevokeAccessResponse, ApiRequestError, RevokeAccessDto>({
    mutationFn: revokeAccess,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
    },
  });
}
