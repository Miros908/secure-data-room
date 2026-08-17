import { buildFolderPath } from './folder-path';

describe('buildFolderPath', () => {
  it('builds a root path from the folder id', () => {
    expect(buildFolderPath(null, 'aaa')).toBe('/aaa/');
  });

  it('appends the id to a parent path', () => {
    expect(buildFolderPath('/aaa/', 'bbb')).toBe('/aaa/bbb/');
  });
});
