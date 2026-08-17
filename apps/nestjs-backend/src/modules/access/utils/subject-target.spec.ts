import { toAccessTarget, toSubjectRef } from './subject-target';

describe('toAccessTarget', () => {
  it('maps a data room to null folder and file', () => {
    expect(
      toAccessTarget({
        type: 'data_room',
        id: 'room-1',
        dataRoomId: 'room-1',
        ownerId: 'owner-1',
        folderId: null,
        folderPath: null,
      }),
    ).toEqual({
      dataRoomId: 'room-1',
      folderId: null,
      fileId: null,
    });
  });

  it('maps a folder to its id', () => {
    expect(
      toAccessTarget({
        type: 'folder',
        id: 'folder-1',
        dataRoomId: 'room-1',
        ownerId: 'owner-1',
        folderId: 'folder-1',
        folderPath: '/folder-1/',
      }),
    ).toEqual({
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      fileId: null,
    });
  });

  it('maps a file to its id', () => {
    expect(
      toAccessTarget({
        type: 'file',
        id: 'file-1',
        dataRoomId: 'room-1',
        ownerId: 'owner-1',
        folderId: 'folder-1',
        folderPath: '/folder-1/',
      }),
    ).toEqual({
      dataRoomId: 'room-1',
      folderId: null,
      fileId: 'file-1',
    });
  });
});

describe('toSubjectRef', () => {
  it('prefers file, then folder, then data room', () => {
    expect(
      toSubjectRef({
        dataRoomId: 'room-1',
        folderId: null,
        fileId: 'file-1',
      }),
    ).toEqual({ type: 'file', subjectId: 'file-1' });

    expect(
      toSubjectRef({
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
      }),
    ).toEqual({ type: 'folder', subjectId: 'folder-1' });

    expect(
      toSubjectRef({
        dataRoomId: 'room-1',
        folderId: null,
        fileId: null,
      }),
    ).toEqual({ type: 'data_room', subjectId: 'room-1' });
  });
});
