import { describe, expect, it } from 'vitest';
import {
  parseShareToken,
  shareHref,
} from '@/app/(pages)/share/components/share-location';

describe('share-location', () => {
  it('parseShareToken accepts a non-empty token and rejects empty', () => {
    expect(parseShareToken('secret-token')).toBe('secret-token');
    expect(parseShareToken('')).toBeUndefined();
    expect(parseShareToken(null)).toBeUndefined();
  });

  it('shareHref puts token and optional folderId in the query', () => {
    const folderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(shareHref({ token: 'abc' })).toBe('/share?token=abc');
    expect(shareHref({ token: 'abc', folderId })).toBe(
      `/share?token=abc&folderId=${folderId}`,
    );
    expect(shareHref({ token: 'abc', folderId, fileId: folderId })).toBe(
      `/share?token=abc&folderId=${folderId}&fileId=${folderId}`,
    );
    expect(shareHref({ token: 'abc', folderId })).not.toContain('name=');
  });
});
