export const foldersQueryKeys = {
  all: ['folders'] as const,
  contents: (input: {
    folderId?: string;
    dataRoomId?: string;
    token?: string;
  }) => [...foldersQueryKeys.all, 'contents', input] as const,
};
