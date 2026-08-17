export type StorageDriver = 'local' | 'r2';

export type StorageConfig = {
  driver: StorageDriver;
  keyPrefix: string;
  local: {
    dir: string;
    publicBaseUrl: string;
    signingSecret: string;
  };
  r2: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  } | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function loadStorageConfig(): StorageConfig {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').trim();
  if (driver !== 'local' && driver !== 'r2') {
    throw new Error(`STORAGE_DRIVER must be "local" or "r2", got "${driver}"`);
  }

  const port = process.env.PORT ?? '4000';
  const isProduction = process.env.NODE_ENV === 'production';
  const signingSecret =
    process.env.STORAGE_LOCAL_SIGNING_SECRET?.trim() ||
    (isProduction ? '' : 'local-dev-signing-secret');

  if (driver === 'local' && !signingSecret) {
    throw new Error('STORAGE_LOCAL_SIGNING_SECRET is not set');
  }

  return {
    driver,
    keyPrefix: process.env.STORAGE_KEY_PREFIX?.trim() ?? '',
    local: {
      dir: process.env.STORAGE_LOCAL_DIR?.trim() || '.storage',
      publicBaseUrl: (
        process.env.STORAGE_PUBLIC_BASE_URL ?? `http://localhost:${port}`
      ).replace(/\/$/, ''),
      signingSecret,
    },
    r2:
      driver === 'r2'
        ? {
            endpoint: required('R2_ENDPOINT').replace(/\/$/, ''),
            accessKeyId: required('R2_ACCESS_KEY_ID'),
            secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
            bucket: required('R2_BUCKET'),
          }
        : null,
  };
}
