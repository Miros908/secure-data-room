import { coveringFolderIds, parseFolderPath } from './folder-path';

describe('parseFolderPath', () => {
  it('splits a materialized UUID path', () => {
    expect(parseFolderPath('/aaa/bbb/')).toEqual(['aaa', 'bbb']);
  });

  it('returns an empty list for missing paths', () => {
    expect(parseFolderPath(null)).toEqual([]);
    expect(parseFolderPath(undefined)).toEqual([]);
    expect(parseFolderPath('')).toEqual([]);
    expect(parseFolderPath('/')).toEqual([]);
  });
});

describe('coveringFolderIds', () => {
  it('unions folderId with ids from the path', () => {
    expect(
      coveringFolderIds({
        folderId: 'ccc',
        folderPath: '/aaa/bbb/',
      }).sort(),
    ).toEqual(['aaa', 'bbb', 'ccc']);
  });

  it('deduplicates when the path already includes folderId', () => {
    expect(
      coveringFolderIds({
        folderId: 'bbb',
        folderPath: '/aaa/bbb/',
      }).sort(),
    ).toEqual(['aaa', 'bbb']);
  });

  it('returns only folderId when the path is empty', () => {
    expect(
      coveringFolderIds({
        folderId: 'aaa',
        folderPath: null,
      }),
    ).toEqual(['aaa']);
  });
});
