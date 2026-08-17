import {
  ancestorCoveringQuery,
  childAncestorChain,
  inheritedAncestorChain,
  inheritedFolderIds,
  nearestCoveringSource,
  shareTargetKey,
  toSharingSummary,
} from './sharing-coverage';

const room = {
  dataRoomId: 'room-1',
  dataRoomName: 'Комната',
};

describe('shareTargetKey', () => {
  it('keys a room, folder, and file distinctly', () => {
    expect(
      shareTargetKey({ dataRoomId: 'room-1', folderId: null, fileId: null }),
    ).toBe('data_room:room-1');
    expect(
      shareTargetKey({
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
      }),
    ).toBe('folder:folder-1');
    expect(
      shareTargetKey({
        dataRoomId: 'room-1',
        folderId: null,
        fileId: 'file-1',
      }),
    ).toBe('file:file-1');
  });
});

describe('inheritedFolderIds', () => {
  it('uses only ancestor folders for a folder subject', () => {
    expect(
      inheritedFolderIds({
        type: 'folder',
        folderId: 'legal',
        folderPath: '/root/',
      }),
    ).toEqual(['root']);
  });

  it('drops the subject when the path accidentally includes it', () => {
    expect(
      inheritedFolderIds({
        type: 'folder',
        folderId: 'legal',
        folderPath: '/root/legal/',
      }),
    ).toEqual(['root']);
  });

  it('appends the parent folder for a file', () => {
    expect(
      inheritedFolderIds({
        type: 'file',
        folderId: 'legal',
        folderPath: '/root/',
      }),
    ).toEqual(['root', 'legal']);
  });

  it('returns nothing for a room or a root file', () => {
    expect(
      inheritedFolderIds({
        type: 'data_room',
        folderId: null,
        folderPath: null,
      }),
    ).toEqual([]);
    expect(
      inheritedFolderIds({
        type: 'file',
        folderId: null,
        folderPath: null,
      }),
    ).toEqual([]);
  });
});

describe('ancestorCoveringQuery', () => {
  it('is null for a data room', () => {
    expect(
      ancestorCoveringQuery({
        type: 'data_room',
        dataRoomId: 'room-1',
        folderId: null,
        folderPath: null,
      }),
    ).toBeNull();
  });

  it('keeps the room and ancestor folders, not the subject itself', () => {
    expect(
      ancestorCoveringQuery({
        type: 'folder',
        dataRoomId: 'room-1',
        folderId: 'legal',
        folderPath: '/root/legal/',
      }),
    ).toEqual({ dataRoomId: 'room-1', folderIds: ['root'] });
    expect(
      ancestorCoveringQuery({
        type: 'file',
        dataRoomId: 'room-1',
        folderId: 'legal',
        folderPath: '/root/',
      }),
    ).toEqual({ dataRoomId: 'room-1', folderIds: ['root', 'legal'] });
  });
});

describe('nearestCoveringSource', () => {
  const legal = {
    type: 'folder' as const,
    id: 'legal',
    name: 'Legal',
    dataRoomId: 'room-1',
  };
  const roomSource = {
    type: 'data_room' as const,
    id: 'room-1',
    name: 'Комната',
    dataRoomId: 'room-1',
  };

  it('picks the nearest ancestor with any share', () => {
    const coverage = new Map([
      [
        'data_room:room-1',
        { peopleCount: 1, pendingCount: 0, hasPublicLink: false },
      ],
      [
        'folder:legal',
        { peopleCount: 0, pendingCount: 0, hasPublicLink: true },
      ],
    ]);

    expect(nearestCoveringSource([legal, roomSource], coverage)?.id).toBe(
      'legal',
    );
  });

  it('falls through to the room when closer folders are uncovered', () => {
    const coverage = new Map([
      [
        'data_room:room-1',
        { peopleCount: 2, pendingCount: 0, hasPublicLink: false },
      ],
    ]);

    expect(nearestCoveringSource([legal, roomSource], coverage)?.type).toBe(
      'data_room',
    );
  });

  it('returns null when nothing covers the node', () => {
    expect(nearestCoveringSource([legal, roomSource], new Map())).toBeNull();
  });
});

describe('toSharingSummary', () => {
  it('attaches inherited source without inventing direct counts', () => {
    const inheritedFrom = {
      type: 'folder' as const,
      id: 'legal',
      name: 'Legal',
      dataRoomId: 'room-1',
    };

    expect(toSharingSummary(undefined, inheritedFrom)).toEqual({
      peopleCount: 0,
      pendingCount: 0,
      hasPublicLink: false,
      inheritedFrom,
    });
  });
});

describe('childAncestorChain', () => {
  it('starts at the current folder then walks out to the room', () => {
    const chain = childAncestorChain({
      ...room,
      currentFolder: { id: 'legal', name: 'Legal' },
      ancestorFolders: [{ id: 'root', name: 'Root' }],
    });

    expect(chain.map((item) => item.id)).toEqual(['legal', 'root', 'room-1']);
  });

  it('is only the room at the data room root', () => {
    const chain = childAncestorChain({
      ...room,
      currentFolder: null,
      ancestorFolders: [],
    });

    expect(chain).toEqual([
      {
        type: 'data_room',
        id: 'room-1',
        name: 'Комната',
        dataRoomId: 'room-1',
      },
    ]);
  });
});

describe('inheritedAncestorChain', () => {
  it('lists nearest folders first', () => {
    const chain = inheritedAncestorChain({
      ...room,
      ancestorFolders: [
        { id: 'root', name: 'Root' },
        { id: 'legal', name: 'Legal' },
      ],
    });

    expect(chain.map((item) => item.id)).toEqual(['legal', 'root', 'room-1']);
  });
});
