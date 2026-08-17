export type AccessSubject = {
  type: 'data_room' | 'folder' | 'file';
  id: string;
  dataRoomId: string;
  ownerId: string;
  folderId: string | null;
  folderPath: string | null;
};

export type CoveringAccessQuery = {
  dataRoomId: string;
  folderIds: string[];
  fileId?: string;
};

export type CoveringGrantQuery = {
  userId: string;
  dataRoomId: string;
  folderIds: string[];
  fileId?: string;
};

export type CoveringPublicLinkQuery = {
  tokenHash: string;
  dataRoomId: string;
  folderIds: string[];
  fileId?: string;
};

export type ResolveAccessParams = {
  userId?: string | null;
  tokenHash?: string | null;
  token?: string | null;
  subject: AccessSubject;
};
