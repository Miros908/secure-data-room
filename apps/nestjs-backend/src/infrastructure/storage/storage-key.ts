import { StorageKeyInvalidError } from './storage.errors';

const MAX_KEY_LENGTH = 512;
const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/._-]*$/;

export function assertSafeStorageKey(key: string): void {
  if (
    key.length === 0 ||
    key.length > MAX_KEY_LENGTH ||
    !SAFE_KEY.test(key) ||
    key.includes('..') ||
    key.includes('//') ||
    key.endsWith('/')
  ) {
    throw new StorageKeyInvalidError(key);
  }
}
