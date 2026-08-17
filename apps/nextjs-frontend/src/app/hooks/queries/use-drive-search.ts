import { useInfiniteQuery } from '@tanstack/react-query';
import type { SearchDriveResponse } from '@sdr/shared/search';
import { searchDrive } from '@/app/api/search-drive.fetcher';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export type DriveSearchInput = {
  q: string;
  dataRoomId?: string;
  token?: string;
  enabled?: boolean;
};

export function useDriveSearch(input: DriveSearchInput) {
  const q = input.q.trim();
  const dataRoomId = input.dataRoomId;
  const token = input.token;
  const enabled =
    (input.enabled ?? true) && q.length > 0 && Boolean(dataRoomId);

  return useInfiniteQuery<SearchDriveResponse, ApiRequestError>({
    queryKey: searchQueryKeys.drive({
      q,
      dataRoomId: dataRoomId ?? '',
      token,
    }),
    queryFn: ({ pageParam }) => {
      if (!dataRoomId) {
        throw new Error('data_room_id_required');
      }

      return searchDrive({
        q,
        dataRoomId,
        token,
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
      });
    },
    enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
