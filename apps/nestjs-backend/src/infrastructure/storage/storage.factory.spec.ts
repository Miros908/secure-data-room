import { createStorageAdapter } from './storage.factory';
import { LocalStorageAdapter } from './local/local-storage.adapter';
import { R2StorageAdapter } from './r2/r2-storage.adapter';
import type { StorageConfig } from './storage.config';

const localConfig: StorageConfig = {
  driver: 'local',
  keyPrefix: '',
  local: {
    dir: '/tmp/sdr-test',
    publicBaseUrl: 'http://localhost:4000',
    signingSecret: 'secret',
  },
  r2: null,
};

describe('createStorageAdapter', () => {
  it('builds a local adapter', () => {
    expect(createStorageAdapter(localConfig)).toBeInstanceOf(
      LocalStorageAdapter,
    );
  });

  it('throws when the r2 driver is missing r2 config', () => {
    expect(() =>
      createStorageAdapter({ ...localConfig, driver: 'r2', r2: null }),
    ).toThrow('R2 config is missing');
  });

  it('builds an R2 adapter when config is present', () => {
    const adapter = createStorageAdapter({
      ...localConfig,
      driver: 'r2',
      r2: {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        bucket: 'bucket',
      },
    });

    expect(adapter).toBeInstanceOf(R2StorageAdapter);
  });
});
