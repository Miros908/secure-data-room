import {
  getSessionClearCookieOptions,
  getSessionCookieOptions,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from './auth.constants';

describe('getSessionCookieOptions', () => {
  it('uses Lax on http localhost so local login keeps working', () => {
    expect(getSessionCookieOptions({ NODE_ENV: 'development' })).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    expect(
      getSessionCookieOptions({ NODE_ENV: 'development' }).partitioned,
    ).toBeUndefined();
  });

  it('uses None + Secure + Partitioned across Vercel and Render', () => {
    expect(getSessionCookieOptions({ NODE_ENV: 'production' })).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    });
  });
});

describe('serializeSessionCookie', () => {
  it('writes Partitioned into the production Set-Cookie header', () => {
    const header = serializeSessionCookie(
      'abc',
      getSessionCookieOptions({ NODE_ENV: 'production' }),
    );

    expect(header).toContain('session=abc');
    expect(header).toMatch(/path=\//i);
    expect(header).toMatch(/httponly/i);
    expect(header).toMatch(/secure/i);
    expect(header).toMatch(/samesite=none/i);
    expect(header).toMatch(/partitioned/i);
    expect(header).toMatch(/max-age=43200/i);
  });

  it('omits Partitioned on localhost Lax cookies', () => {
    const header = serializeSessionCookie(
      'abc',
      getSessionCookieOptions({ NODE_ENV: 'development' }),
    );

    expect(header).toMatch(/samesite=lax/i);
    expect(header).not.toMatch(/partitioned/i);
    expect(header).not.toMatch(/secure/i);
  });
});

describe('getSessionClearCookieOptions', () => {
  it('keeps the same site flags and drops maxAge', () => {
    const options = getSessionClearCookieOptions({ NODE_ENV: 'production' });
    expect(options.maxAge).toBeUndefined();
    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
    expect(options.partitioned).toBe(true);
  });

  it('clears with the same Partitioned flag so Safari drops the cookie', () => {
    const header = serializeClearedSessionCookie({ NODE_ENV: 'production' });
    expect(header).toMatch(/session=/);
    expect(header).toMatch(/partitioned/i);
    expect(header).not.toMatch(/max-age=/i);
    expect(header).toMatch(/expires=/i);
  });
});
