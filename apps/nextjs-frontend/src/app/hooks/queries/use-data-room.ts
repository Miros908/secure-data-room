import { useQuery } from '@tanstack/react-query';
import type { DataRoom } from '@sdr/shared/data-rooms';
import { getDataRoom } from '@/app/api/get-data-room.fetcher';
import { dataRoomsQueryKeys } from '@/app/lib/data-rooms.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useDataRoom(input: {
  id: string | undefined;
  token?: string;
  enabled?: boolean;
}) {
  const id = input.id ?? '';

  return useQuery<DataRoom, ApiRequestError>({
    queryKey: dataRoomsQueryKeys.detail(id, input.token),
    queryFn: () => getDataRoom(id, input.token),
    enabled: (input.enabled ?? true) && Boolean(input.id),
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
