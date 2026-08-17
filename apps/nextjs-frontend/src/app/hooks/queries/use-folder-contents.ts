import { useQuery } from '@tanstack/react-query';
import type { FolderContents } from '@sdr/shared/folders';
import { listFolderContents } from '@/app/api/list-folder-contents.fetcher';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export type FolderContentsInput = {
  dataRoomId?: string;
  folderId?: string;
  token?: string;
  enabled?: boolean;
};

export function useFolderContents(input: FolderContentsInput) {
  const folderId = input.folderId;
  const dataRoomId = folderId ? undefined : input.dataRoomId;
  const token = input.token;
  const enabled = (input.enabled ?? true) && Boolean(folderId || dataRoomId);

  return useQuery<FolderContents, ApiRequestError>({
    queryKey: foldersQueryKeys.contents({ folderId, dataRoomId, token }),
    queryFn: () => listFolderContents({ folderId, dataRoomId, token }),
    enabled,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
