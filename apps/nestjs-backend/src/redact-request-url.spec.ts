import { redactRequestUrl } from './redact-request-url';

describe('redactRequestUrl', () => {
  it('replaces token query values and leaves the rest', () => {
    expect(
      redactRequestUrl('GET /files/abc?token=supersecret&x=1 -> 404 not_found'),
    ).toBe('GET /files/abc?token=[redacted]&x=1 -> 404 not_found');
  });

  it('leaves URLs without a token query unchanged', () => {
    expect(redactRequestUrl('GET /auth/me -> 200')).toBe('GET /auth/me -> 200');
  });

  it('API-15 redacts local download signatures', () => {
    expect(
      redactRequestUrl('/storage/objects?key=a/b.pdf&sig=deadbeef&expires=1'),
    ).toBe('/storage/objects?key=a/b.pdf&sig=[redacted]&expires=1');
  });
});
