import { useQuery } from '@tanstack/react-query';
import type { FileDetail } from '@sdr/shared/files';
import { getFile } from '@/app/api/get-file.fetcher';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

const SIGNED_URL_STALE_MS = 60 * 1000;

export function useFile(fileId: string | undefined, token?: string) {
  return useQuery<FileDetail, ApiRequestError>({
    queryKey: filesQueryKeys.detail(fileId ?? '', token),
    queryFn: () => {
      if (!fileId) {
        throw new Error('file_id_required');
      }

      return getFile(fileId, token);
    },
    enabled: Boolean(fileId),
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
    staleTime: SIGNED_URL_STALE_MS,
  });
}
