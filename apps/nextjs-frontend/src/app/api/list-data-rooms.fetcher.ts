import {
  listDataRoomsResponseSchema,
  type ListDataRoomsResponse,
} from '@sdr/shared/data-rooms';
import { apiClient } from '@/infrastructure/http/api-client';

export async function listDataRooms(): Promise<ListDataRoomsResponse> {
  const response = await apiClient.get('/data-rooms');
  return listDataRoomsResponseSchema.parse(response.data);
}
