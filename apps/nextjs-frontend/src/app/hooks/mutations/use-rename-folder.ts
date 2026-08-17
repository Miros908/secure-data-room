import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Folder, RenameFolderDto } from '@sdr/shared/folders';
import { renameFolder } from '@/app/api/rename-folder.poster';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export type RenameFolderInput = RenameFolderDto & { id: string };

export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation<Folder, ApiRequestError, RenameFolderInput>({
    mutationFn: ({ id, ...dto }) => renameFolder(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
    },
  });
}
