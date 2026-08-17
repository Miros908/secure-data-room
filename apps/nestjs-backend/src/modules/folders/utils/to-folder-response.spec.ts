import { toFolderResponse } from './to-folder-response';

describe('toFolderResponse', () => {
  it('omits path and owner from the public DTO', () => {
    expect(
      toFolderResponse({
        id: 'folder-1',
        name: 'Reports',
        parentId: null,
        dataRoomId: 'room-1',
        ownerId: 'owner-1',
        path: '/folder-1/',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toEqual({
      id: 'folder-1',
      name: 'Reports',
      parentId: null,
      dataRoomId: 'room-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
