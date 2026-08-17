import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteFile, type DeleteFileResponse } from '@/app/api/delete-file.poster';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation<DeleteFileResponse, ApiRequestError, string>({
    mutationFn: deleteFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
    },
  });
}
