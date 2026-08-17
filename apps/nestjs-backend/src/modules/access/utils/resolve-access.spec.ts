import {
  canShare,
  canWrite,
  isGrantUpgrade,
  maxRole,
  resolveEffectiveRole,
  roleFromPublicLink,
  toCoveringQuery,
  toVisibleRole,
} from './resolve-access';

const folder = {
  type: 'folder' as const,
  id: 'folder-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};

const file = {
  type: 'file' as const,
  id: 'file-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};

describe('resolveEffectiveRole', () => {
  it('returns owner without considering grants', () => {
    expect(
      resolveEffectiveRole({
        userId: 'owner-1',
        ownerId: 'owner-1',
        grantRoles: ['editor'],
      }),
    ).toBe('owner');
  });

  it('returns none when there is no user', () => {
    expect(
      resolveEffectiveRole({
        userId: null,
        ownerId: 'owner-1',
        grantRoles: ['viewer'],
      }),
    ).toBe('none');
  });

  it('returns the highest covering grant', () => {
    expect(
      resolveEffectiveRole({
        userId: 'user-1',
        ownerId: 'owner-1',
        grantRoles: ['viewer', 'editor'],
      }),
    ).toBe('editor');
  });

  it('returns none when no grant covers the resource', () => {
    expect(
      resolveEffectiveRole({
        userId: 'user-1',
        ownerId: 'owner-1',
        grantRoles: [],
      }),
    ).toBe('none');
  });
});

describe('toCoveringQuery', () => {
  it('does not pass a file id for folder subjects', () => {
    const query = toCoveringQuery(folder);

    expect(query.dataRoomId).toBe('room-1');
    expect(query.fileId).toBeUndefined();
    expect([...query.folderIds].sort()).toEqual(['folder-1', 'root']);
  });

  it('passes the file id only for file subjects', () => {
    const query = toCoveringQuery(file);

    expect(query.dataRoomId).toBe('room-1');
    expect(query.fileId).toBe('file-1');
    expect([...query.folderIds].sort()).toEqual(['folder-1', 'root']);
  });
});

describe('roleFromPublicLink', () => {
  it('returns viewer when a public link covers the resource', () => {
    expect(roleFromPublicLink(true)).toBe('viewer');
  });

  it('returns none when the public link does not cover the resource', () => {
    expect(roleFromPublicLink(false)).toBe('none');
  });
});

describe('canWrite', () => {
  it('allows owner and editor', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('editor')).toBe(true);
  });

  it('rejects viewer and none', () => {
    expect(canWrite('viewer')).toBe(false);
    expect(canWrite('none')).toBe(false);
  });
});

describe('canShare', () => {
  it('allows only owner', () => {
    expect(canShare('owner')).toBe(true);
    expect(canShare('editor')).toBe(false);
    expect(canShare('viewer')).toBe(false);
    expect(canShare('none')).toBe(false);
  });
});

describe('isGrantUpgrade', () => {
  it('upgrades viewer to editor', () => {
    expect(isGrantUpgrade('viewer', 'editor')).toBe(true);
  });

  it('does not downgrade or no-op', () => {
    expect(isGrantUpgrade('editor', 'viewer')).toBe(false);
    expect(isGrantUpgrade('editor', 'editor')).toBe(false);
    expect(isGrantUpgrade('viewer', 'viewer')).toBe(false);
  });
});

describe('maxRole', () => {
  it('prefers a session editor over a public viewer', () => {
    expect(maxRole('editor', 'viewer')).toBe('editor');
  });

  it('upgrades none to a public viewer', () => {
    expect(maxRole('none', 'viewer')).toBe('viewer');
  });
});

describe('toVisibleRole', () => {
  it('keeps resolved roles', () => {
    expect(toVisibleRole('owner')).toBe('owner');
    expect(toVisibleRole('editor')).toBe('editor');
  });

  it('throws on none', () => {
    expect(() => toVisibleRole('none')).toThrow('unexpected_none_role');
  });
});
