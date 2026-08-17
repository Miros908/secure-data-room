import { useQuery } from '@tanstack/react-query';
import type { FileDetail } from '@sdr/shared/files';
import { getFileVersion } from '@/app/api/get-file-version.fetcher';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

const SIGNED_URL_STALE_MS = 60 * 1000;

export function useFileVersion(
  fileId: string | undefined,
  versionId: string | undefined,
  token?: string,
  enabled = true,
) {
  return useQuery<FileDetail, ApiRequestError>({
    queryKey: filesQueryKeys.version(fileId ?? '', versionId ?? '', token),
    queryFn: () => {
      if (!fileId || !versionId) {
        throw new Error('file_version_required');
      }

      return getFileVersion(fileId, versionId, token);
    },
    enabled: Boolean(fileId && versionId) && enabled,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
    staleTime: SIGNED_URL_STALE_MS,
  });
}
