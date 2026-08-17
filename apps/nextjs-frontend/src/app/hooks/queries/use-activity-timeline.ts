import { useInfiniteQuery } from '@tanstack/react-query';
import type { ActivityTimeline } from '@sdr/shared/activity';
import { getActivityTimeline } from '@/app/api/get-activity-timeline.fetcher';
import { activityQueryKeys } from '@/app/lib/activity.query-keys';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function useActivityTimeline(
  roomId: string | undefined,
  actorKey?: string,
) {
  return useInfiniteQuery<ActivityTimeline, ApiRequestError>({
    queryKey: activityQueryKeys.timeline(roomId ?? '', actorKey),
    queryFn: ({ pageParam }) => {
      if (!roomId) {
        throw new Error('room_id_required');
      }

      return getActivityTimeline(roomId, {
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
        actorKey,
      });
    },
    enabled: Boolean(roomId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: (count, error) =>
      error.statusCode !== 401 &&
      error.statusCode !== 403 &&
      error.statusCode !== 404 &&
      count < 2,
  });
}
