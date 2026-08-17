import {
  signLocalDownloadUrl,
  verifyLocalDownloadUrl,
} from './local-download-url';

describe('local download URL', () => {
  const secret = 'test-secret';

  it('round-trips claims through sign and verify', () => {
    const signed = signLocalDownloadUrl({
      publicBaseUrl: 'http://localhost:4000',
      secret,
      key: 'dev/rooms/1/files/2/v1.pdf',
      filename: 'Договор.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 120,
    });

    const claims = verifyLocalDownloadUrl(secret, urlParams(signed.url));

    expect(claims.key).toBe('dev/rooms/1/files/2/v1.pdf');
    expect(claims.filename).toBe('Договор.pdf');
    expect(claims.contentType).toBe('application/pdf');
  });

  it('signs attachment separately from inline', () => {
    const inline = signLocalDownloadUrl({
      publicBaseUrl: 'http://localhost:4000',
      secret,
      key: 'a/b',
      filename: 'f.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 120,
    });
    const attachment = signLocalDownloadUrl({
      publicBaseUrl: 'http://localhost:4000',
      secret,
      key: 'a/b',
      filename: 'f.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 120,
      disposition: 'attachment',
    });

    expect(inline.url).not.toContain('disposition=');
    expect(attachment.url).toContain('disposition=attachment');
    expect(
      verifyLocalDownloadUrl(secret, urlParams(attachment.url)).disposition,
    ).toBe('attachment');
  });

  it('rejects a tampered expiry', () => {
    const signed = signLocalDownloadUrl({
      publicBaseUrl: 'http://localhost:4000',
      secret,
      key: 'a/b',
      filename: 'f',
      contentType: 'text/plain',
      expiresInSeconds: 120,
    });
    const params = urlParams(signed.url);
    params.set('expires', String(Number(params.get('expires')) + 99999));

    expect(() => verifyLocalDownloadUrl(secret, params)).toThrow(
      'invalid_signature',
    );
  });

  it('rejects an expired URL', () => {
    const signed = signLocalDownloadUrl({
      publicBaseUrl: 'http://localhost:4000',
      secret,
      key: 'a/b',
      filename: 'f',
      contentType: 'text/plain',
      expiresInSeconds: -1,
    });

    expect(() => verifyLocalDownloadUrl(secret, urlParams(signed.url))).toThrow(
      'expired',
    );
  });
});

function urlParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}
