import { useQuery } from '@tanstack/react-query';
import type { ActivitySummary } from '@sdr/shared/activity';
import { getActivitySummary } from '@/app/api/get-activity-summary.fetcher';
import { activityQueryKeys } from '@/app/lib/activity.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useActivitySummary(roomId: string | undefined) {
  return useQuery<ActivitySummary, ApiRequestError>({
    queryKey: activityQueryKeys.summary(roomId ?? ''),
    queryFn: () => {
      if (!roomId) {
        throw new Error('room_id_required');
      }

      return getActivitySummary(roomId);
    },
    enabled: Boolean(roomId),
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
