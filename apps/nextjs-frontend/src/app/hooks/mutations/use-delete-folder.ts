import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeleteFolderResponse } from '@sdr/shared/folders';
import { deleteFolder } from '@/app/api/delete-folder.poster';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation<DeleteFolderResponse, ApiRequestError, string>({
    mutationFn: deleteFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
    },
  });
}
