import { dataRoomSchema, type DataRoom } from '@sdr/shared/data-rooms';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getDataRoom(
  id: string,
  token?: string,
): Promise<DataRoom> {
  const response = await apiClient.get(`/data-rooms/${id}`, {
    params: token ? { token } : undefined,
  });
  return dataRoomSchema.parse(response.data);
}
