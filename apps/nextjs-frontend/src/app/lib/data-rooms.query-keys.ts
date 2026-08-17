export const dataRoomsQueryKeys = {
  all: ['data-rooms'] as const,
  list: () => [...dataRoomsQueryKeys.all, 'list'] as const,
  detail: (id: string, token?: string) =>
    [...dataRoomsQueryKeys.all, 'detail', id, token ?? ''] as const,
};
