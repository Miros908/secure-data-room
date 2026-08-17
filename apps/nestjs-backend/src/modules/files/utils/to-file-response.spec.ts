import { toFileResponse } from './to-file-response';

describe('toFileResponse', () => {
  const file = {
    id: 'file-1',
    name: 'a.pdf',
    dataRoomId: 'room-1',
    folderId: null,
    mimeType: 'application/pdf',
    sizeBytes: 12,
    storageKey: 'room-1/file-1/version-1',
    currentVersionId: 'version-1',
    versionNumber: 2,
    versionCount: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('serializes dates as ISO strings and version fields', () => {
    expect(toFileResponse(file)).toEqual({
      id: 'file-1',
      name: 'a.pdf',
      dataRoomId: 'room-1',
      folderId: null,
      mimeType: 'application/pdf',
      sizeBytes: 12,
      versionNumber: 2,
      versionCount: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('includes isNewVersion when asked', () => {
    expect(toFileResponse(file, { isNewVersion: true }).isNewVersion).toBe(
      true,
    );
  });
});
