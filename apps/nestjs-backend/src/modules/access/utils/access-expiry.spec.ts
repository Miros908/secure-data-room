import { MAX_ACCESS_TTL_MS } from '../access.constants';
import {
  inviteAcceptDeadline,
  mergeAccessExpiry,
  parseAccessExpiresAt,
  remainingAccessTtlSeconds,
} from './access-expiry';

describe('access expiry helpers', () => {
  const now = Date.now();

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects past and >1 year expiresAt', () => {
    expect(() =>
      parseAccessExpiresAt(new Date(now - 1000).toISOString()),
    ).toThrow('invalid_expires_at');
    expect(() =>
      parseAccessExpiresAt(
        new Date(now + MAX_ACCESS_TTL_MS + 60_000).toISOString(),
      ),
    ).toThrow('invalid_expires_at');
  });

  it('merges covering expiries: unlimited wins, else max date', () => {
    expect(mergeAccessExpiry([])).toBeNull();
    expect(mergeAccessExpiry([null, new Date(now + 1000)])).toBeNull();
    const later = new Date(now + 5000);
    expect(mergeAccessExpiry([new Date(now + 1000), later])?.getTime()).toBe(
      later.getTime(),
    );
  });

  it('caps signed URL TTL to remaining access', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    expect(
      remainingAccessTtlSeconds(
        new Date('2026-08-16T12:02:00.000Z'),
        15 * 60,
        30,
      ),
    ).toBe(120);
    expect(remainingAccessTtlSeconds(null, 15 * 60, 30)).toBe(15 * 60);
  });

  it('shortens invite accept deadline to access expiry', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    const hour = new Date('2026-08-16T13:00:00.000Z');
    expect(
      inviteAcceptDeadline(hour, 7 * 24 * 60 * 60 * 1000).toISOString(),
    ).toBe(hour.toISOString());
  });
});
