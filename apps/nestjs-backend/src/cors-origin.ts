export class CorsOriginConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorsOriginConfigError';
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function parseCorsOrigin(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): true | string | string[] {
  const value = raw?.trim();
  const allowReflect = env.NODE_ENV === 'development';

  if (!value || value === 'true' || value === '*') {
    if (!allowReflect) {
      throw new CorsOriginConfigError(
        'CORS_ORIGIN must be an explicit allowlist when NODE_ENV is not development',
      );
    }
    return true;
  }

  const origins = value
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (origins.length === 0) {
    if (!allowReflect) {
      throw new CorsOriginConfigError(
        'CORS_ORIGIN must be an explicit allowlist when NODE_ENV is not development',
      );
    }
    return true;
  }

  return origins.length === 1 ? origins[0] : origins;
}

export function isAllowedMutatingOrigin(
  method: string,
  origin: string | undefined,
  corsOrigin: true | string | string[],
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }

  if (corsOrigin === true) {
    return true;
  }

  if (!origin) {
    return true;
  }

  const allowed = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
  return allowed.includes(origin);
}
