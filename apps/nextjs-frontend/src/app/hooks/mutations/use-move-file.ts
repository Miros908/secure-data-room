import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FileDto, MoveFileDto } from '@sdr/shared/files';
import { moveFile } from '@/app/api/move-file.poster';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export type MoveFileInput = MoveFileDto & { id: string };

export function useMoveFile() {
  const queryClient = useQueryClient();

  return useMutation<FileDto, ApiRequestError, MoveFileInput>({
    mutationFn: ({ id, ...dto }) => moveFile(id, dto),
    onSuccess: (_file, variables) => {
      void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: filesQueryKeys.detail(variables.id),
      });
    },
  });
}
