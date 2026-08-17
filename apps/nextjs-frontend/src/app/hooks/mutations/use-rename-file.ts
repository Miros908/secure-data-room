import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FileDto, RenameFileDto } from '@sdr/shared/files';
import { renameFile } from '@/app/api/rename-file.poster';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export type RenameFileInput = RenameFileDto & { id: string };

export function useRenameFile() {
  const queryClient = useQueryClient();

  return useMutation<FileDto, ApiRequestError, RenameFileInput>({
    mutationFn: ({ id, ...dto }) => renameFile(id, dto),
    onSuccess: (_file, variables) => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: filesQueryKeys.detail(variables.id),
      });
    },
  });
}
