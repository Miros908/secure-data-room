import { useQuery } from '@tanstack/react-query';
import type { ListDataRoomsResponse } from '@sdr/shared/data-rooms';
import { listDataRooms } from '@/app/api/list-data-rooms.fetcher';
import { dataRoomsQueryKeys } from '@/app/lib/data-rooms.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useDataRooms() {
  return useQuery<ListDataRoomsResponse, ApiRequestError>({
    queryKey: dataRoomsQueryKeys.list(),
    queryFn: listDataRooms,
  });
}
