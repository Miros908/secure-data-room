export const activityQueryKeys = {
  all: ['activity'] as const,
  summary: (roomId: string) =>
    [...activityQueryKeys.all, 'summary', roomId] as const,
  timeline: (roomId: string, actorKey?: string) =>
    [...activityQueryKeys.all, 'timeline', roomId, actorKey ?? ''] as const,
};
