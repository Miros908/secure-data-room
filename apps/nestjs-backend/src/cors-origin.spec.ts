import {
  CorsOriginConfigError,
  isAllowedMutatingOrigin,
  parseCorsOrigin,
} from './cors-origin';

describe('AUTH-16 parseCorsOrigin', () => {
  it('reflects the request origin in development when unset', () => {
    const env = { NODE_ENV: 'development' };
    expect(parseCorsOrigin(undefined, env)).toBe(true);
    expect(parseCorsOrigin('', env)).toBe(true);
    expect(parseCorsOrigin('true', env)).toBe(true);
    expect(parseCorsOrigin('*', env)).toBe(true);
  });

  it('refuses a missing or wildcard allowlist outside development', () => {
    for (const nodeEnv of ['test', 'production']) {
      const env = { NODE_ENV: nodeEnv };
      expect(() => parseCorsOrigin(undefined, env)).toThrow(
        CorsOriginConfigError,
      );
      expect(() => parseCorsOrigin('', env)).toThrow(CorsOriginConfigError);
      expect(() => parseCorsOrigin('true', env)).toThrow(CorsOriginConfigError);
      expect(() => parseCorsOrigin('*', env)).toThrow(CorsOriginConfigError);
    }
  });

  it('strips a trailing slash from a single origin', () => {
    expect(
      parseCorsOrigin('https://app.vercel.app/', { NODE_ENV: 'production' }),
    ).toBe('https://app.vercel.app');
  });

  it('parses a comma-separated allowlist', () => {
    expect(
      parseCorsOrigin(
        'https://app.vercel.app, https://app-git-main.vercel.app/',
        { NODE_ENV: 'production' },
      ),
    ).toEqual(['https://app.vercel.app', 'https://app-git-main.vercel.app']);
  });
});

describe('AUTH-05 isAllowedMutatingOrigin', () => {
  const allowlist = 'http://localhost:3000';

  it('allows safe methods from any origin', () => {
    expect(
      isAllowedMutatingOrigin('GET', 'https://evil.example', allowlist),
    ).toBe(true);
    expect(
      isAllowedMutatingOrigin('OPTIONS', 'https://evil.example', allowlist),
    ).toBe(true);
  });

  it('allows mutating requests without Origin (non-browser)', () => {
    expect(isAllowedMutatingOrigin('POST', undefined, allowlist)).toBe(true);
  });

  it('allows mutating requests from an allowlisted origin', () => {
    expect(isAllowedMutatingOrigin('POST', allowlist, allowlist)).toBe(true);
  });

  it('rejects mutating requests from a foreign origin', () => {
    expect(
      isAllowedMutatingOrigin('POST', 'https://evil.example', allowlist),
    ).toBe(false);
    expect(
      isAllowedMutatingOrigin('DELETE', 'https://evil.example', allowlist),
    ).toBe(false);
  });
});
