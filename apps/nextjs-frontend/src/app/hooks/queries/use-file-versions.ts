import { useQuery } from '@tanstack/react-query';
import type { FileVersionList } from '@sdr/shared/files';
import { listFileVersions } from '@/app/api/list-file-versions.fetcher';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useFileVersions(
  fileId: string | undefined,
  token?: string,
  enabled = true,
) {
  return useQuery<FileVersionList, ApiRequestError>({
    queryKey: filesQueryKeys.versions(fileId ?? '', token),
    queryFn: () => {
      if (!fileId) {
        throw new Error('file_id_required');
      }

      return listFileVersions(fileId, token);
    },
    enabled: Boolean(fileId) && enabled,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
