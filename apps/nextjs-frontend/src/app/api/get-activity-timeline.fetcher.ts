import {
  activityTimelineSchema,
  type ActivityTimeline,
  type ActivityTimelineQuery,
} from '@sdr/shared/activity';
import { apiClient } from '@/infrastructure/http/api-client';

export async function getActivityTimeline(
  dataRoomId: string,
  query: ActivityTimelineQuery = {},
): Promise<ActivityTimeline> {
  const response = await apiClient.get(`/data-rooms/${dataRoomId}/activity`, {
    params: query,
  });
  return activityTimelineSchema.parse(response.data);
}
