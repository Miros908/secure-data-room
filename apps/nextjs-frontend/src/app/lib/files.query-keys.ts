export const filesQueryKeys = {
  all: ['files'] as const,
  detail: (id: string, token?: string) =>
    [...filesQueryKeys.all, 'detail', id, token ?? ''] as const,
  versions: (id: string, token?: string) =>
    [...filesQueryKeys.all, 'versions', id, token ?? ''] as const,
  version: (id: string, versionId: string, token?: string) =>
    [...filesQueryKeys.all, 'version', id, versionId, token ?? ''] as const,
};
