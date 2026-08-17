import { decodeSearchCursor, encodeSearchCursor } from './search-cursor';

describe('search cursor', () => {
  it('round-trips name, kind and id', () => {
    const cursor = {
      name: 'Term | Sheet.pdf',
      kind: 'file' as const,
      id: '11111111-1111-4111-8111-111111111111',
    };

    expect(decodeSearchCursor(encodeSearchCursor(cursor))).toEqual(cursor);
  });

  it('rejects garbage', () => {
    expect(decodeSearchCursor('not-a-cursor')).toBeNull();
    expect(decodeSearchCursor('')).toBeNull();
  });
});
