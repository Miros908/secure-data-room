import { assertSafeStorageKey } from '../../../infrastructure/storage/storage-key';

export function buildFileStorageKey(
  keyPrefix: string,
  dataRoomId: string,
  fileId: string,
  versionId: string,
): string {
  const prefix = keyPrefix.replace(/^\/+|\/+$/g, '');
  const key = prefix
    ? `${prefix}/${dataRoomId}/${fileId}/${versionId}`
    : `${dataRoomId}/${fileId}/${versionId}`;

  assertSafeStorageKey(key);
  return key;
}
