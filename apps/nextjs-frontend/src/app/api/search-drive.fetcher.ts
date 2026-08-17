import {
  searchDriveQuerySchema,
  searchDriveResponseSchema,
  type SearchDriveQuery,
  type SearchDriveResponse,
} from '@sdr/shared/search';
import { apiClient } from '@/infrastructure/http/api-client';

export async function searchDrive(
  params: SearchDriveQuery,
): Promise<SearchDriveResponse> {
  const query = searchDriveQuerySchema.parse(params);
  const response = await apiClient.get('/search', { params: query });
  return searchDriveResponseSchema.parse(response.data);
}
