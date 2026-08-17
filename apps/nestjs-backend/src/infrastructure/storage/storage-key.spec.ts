import { StorageKeyInvalidError } from './storage.errors';
import { assertSafeStorageKey } from './storage-key';

describe('assertSafeStorageKey', () => {
  it.each(['rooms/abc/files/def/v1.pdf', 'dev/a.png', 'A1._-'])(
    'accepts %s',
    (key) => {
      expect(() => assertSafeStorageKey(key)).not.toThrow();
    },
  );

  it.each([
    '',
    '/abs',
    '../escape',
    'a/../b',
    'a//b',
    'a/b/',
    'has space',
    'кириллица',
  ])('rejects %s', (key) => {
    expect(() => assertSafeStorageKey(key)).toThrow(StorageKeyInvalidError);
  });
});
