import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePublicLinkDto,
  CreatePublicLinkResponse,
} from '@sdr/shared/access';
import { createPublicLink } from '@/app/api/create-public-link.poster';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useCreatePublicLink() {
  const queryClient = useQueryClient();

  return useMutation<
    CreatePublicLinkResponse,
    ApiRequestError,
    CreatePublicLinkDto
  >({
    mutationFn: createPublicLink,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
    },
  });
}
