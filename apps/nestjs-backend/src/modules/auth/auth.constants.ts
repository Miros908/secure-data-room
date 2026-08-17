import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const AUTH_ABUSE_LIMIT = 10;
export const AUTH_ABUSE_WINDOW_MS = 60_000;

type SessionCookieOptions = CookieOptions & { partitioned?: boolean };

export function getSessionCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    partitioned: isProduction || undefined,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

export function getSessionClearCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions {
  return { ...getSessionCookieOptions(env), maxAge: undefined };
}

export function serializeSessionCookie(
  value: string,
  options: SessionCookieOptions = getSessionCookieOptions(),
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    `Path=${options.path ?? '/'}`,
  ];

  if (options.maxAge != null) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    const sameSite =
      typeof options.sameSite === 'string'
        ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)
        : String(options.sameSite);
    parts.push(`SameSite=${sameSite}`);
  }

  if (options.partitioned) {
    parts.push('Partitioned');
  }

  return parts.join('; ');
}

export function serializeClearedSessionCookie(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return serializeSessionCookie('', {
    ...getSessionClearCookieOptions(env),
    expires: new Date(0),
  });
}
