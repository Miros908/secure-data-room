import { generateSessionToken, hashSessionToken } from './session-token';

describe('AUTH-02 session token', () => {
  it('generateSessionToken is 32 bytes of hex', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashSessionToken stores SHA-256, not the raw token', () => {
    const token = generateSessionToken();
    const digest = hashSessionToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(token);
    expect(hashSessionToken(token)).toBe(digest);
  });
});
