export const searchQueryKeys = {
  all: ['search'] as const,
  drive: (input: { q: string; dataRoomId: string; token?: string }) =>
    [...searchQueryKeys.all, 'drive', input] as const,
};
