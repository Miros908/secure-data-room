import {
  fileParentIsVisible,
  folderIsVisible,
  mergeSearchScopes,
} from './search-visibility';

describe('search visibility', () => {
  const granted = '/folder-a/';

  it('folder grant covers the folder and descendants, not parents', () => {
    const visibility = {
      type: 'restricted' as const,
      folderPaths: [granted],
      fileIds: [],
    };

    expect(folderIsVisible('/folder-a/', visibility)).toBe(true);
    expect(folderIsVisible('/folder-a/child/', visibility)).toBe(true);
    expect(folderIsVisible('/other/', visibility)).toBe(false);
    expect(fileParentIsVisible(null, visibility)).toBe(false);
    expect(fileParentIsVisible('/folder-a/', visibility)).toBe(true);
  });

  it('room visibility sees root files', () => {
    expect(fileParentIsVisible(null, { type: 'room' })).toBe(true);
  });

  it('merges a folder grant with a file grant and a room token', () => {
    const folderScope = {
      role: 'editor' as const,
      accessExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
      visibility: {
        type: 'restricted' as const,
        folderPaths: ['/legal/'],
        fileIds: [],
      },
    };
    const fileScope = {
      role: 'viewer' as const,
      accessExpiresAt: null,
      visibility: {
        type: 'restricted' as const,
        folderPaths: [],
        fileIds: ['file-1'],
      },
    };
    const tokenRoom = {
      role: 'viewer' as const,
      accessExpiresAt: new Date('2026-08-20T00:00:00.000Z'),
      visibility: { type: 'room' as const },
    };

    const restricted = mergeSearchScopes(folderScope, fileScope);
    expect(restricted?.visibility).toEqual({
      type: 'restricted',
      folderPaths: ['/legal/'],
      fileIds: ['file-1'],
    });
    expect(restricted?.role).toBe('editor');
    expect(restricted?.accessExpiresAt).toBeNull();

    const withRoom = mergeSearchScopes(restricted, tokenRoom);
    expect(withRoom?.visibility).toEqual({ type: 'room' });
    expect(withRoom?.role).toBe('editor');
  });
});
