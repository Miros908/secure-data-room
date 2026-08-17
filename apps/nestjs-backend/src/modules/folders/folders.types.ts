export type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
  dataRoomId: string;
  ownerId: string;
  path: string;
  createdAt: Date;
};

export type FolderChildRecord = {
  id: string;
  name: string;
  createdAt: Date;
};

export type FileChildRecord = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  versionCount: number;
  createdAt: Date;
};
