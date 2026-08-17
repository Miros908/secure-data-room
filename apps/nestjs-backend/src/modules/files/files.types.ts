export type FileRecord = {
  id: string;
  name: string;
  dataRoomId: string;
  folderId: string | null;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  currentVersionId: string;
  versionNumber: number;
  versionCount: number;
  createdAt: Date;
};

export type FileVersionRecord = {
  id: string;
  fileId: string;
  versionNumber: number;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: Date;
};
