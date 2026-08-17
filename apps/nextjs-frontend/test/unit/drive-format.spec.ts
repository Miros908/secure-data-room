import { describe, expect, it } from 'vitest';
import {
  driveItemKey,
  formatBytes,
  formatVersionCount,
  parseDriveItemKey,
} from '@/app/(pages)/drive/components/drive-format';

describe('drive-format', () => {
  it('driveItemKey round-trips kind and id', () => {
    const key = driveItemKey('file', 'abc:def');
    expect(key).toBe('file:abc:def');
    expect(parseDriveItemKey(key)).toEqual({ kind: 'file', id: 'abc:def' });
    expect(parseDriveItemKey('nope')).toBeNull();
  });

  it('formatBytes uses English units', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('formatVersionCount hides a single version', () => {
    expect(formatVersionCount(1)).toBeNull();
    expect(formatVersionCount(2)).toBe('2 ver.');
  });
});
