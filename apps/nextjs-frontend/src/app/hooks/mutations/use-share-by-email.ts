import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ShareByEmailDto,
  ShareByEmailResponse,
} from '@sdr/shared/access';
import { shareByEmail } from '@/app/api/share-by-email.poster';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useShareByEmail() {
  const queryClient = useQueryClient();

  return useMutation<ShareByEmailResponse, ApiRequestError, ShareByEmailDto>({
    mutationFn: shareByEmail,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
    },
  });
}
