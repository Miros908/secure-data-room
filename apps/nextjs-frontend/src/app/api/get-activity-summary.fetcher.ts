import {
  activitySummarySchema,
  type ActivitySummary,
} from '@sdr/shared/activity';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getActivitySummary(
  dataRoomId: string,
): Promise<ActivitySummary> {
  const response = await apiClient.get(
    `/data-rooms/${dataRoomId}/activity/summary`,
  );
  return activitySummarySchema.parse(response.data);
}
