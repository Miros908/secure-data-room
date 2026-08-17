import type { FileDto } from '@sdr/shared/files';
import type { FileRecord } from '../files.types';

export function toFileResponse(
  file: FileRecord,
  extra: { isNewVersion?: boolean } = {},
): FileDto {
  return {
    id: file.id,
    name: file.name,
    dataRoomId: file.dataRoomId,
    folderId: file.folderId,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    versionNumber: file.versionNumber,
    versionCount: file.versionCount,
    ...(extra.isNewVersion === undefined
      ? {}
      : { isNewVersion: extra.isNewVersion }),
    createdAt: file.createdAt.toISOString(),
  };
}
