import { generateShareToken, hashShareToken } from './share-token';

describe('SHARE-01 / SHARE-02 share token', () => {
  it('generateShareToken is 32 bytes of hex (256 bits)', () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashShareToken stores SHA-256, not the raw token', () => {
    const token = generateShareToken();
    const digest = hashShareToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(token);
    expect(hashShareToken(token)).toBe(digest);
  });
});
