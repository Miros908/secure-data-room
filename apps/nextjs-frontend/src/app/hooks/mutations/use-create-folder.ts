import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateFolderDto, Folder } from '@sdr/shared/folders';
import { createFolder } from '@/app/api/create-folder.poster';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, ApiRequestError, CreateFolderDto>({
    mutationFn: createFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
    },
  });
}
