import { S3Client } from '@aws-sdk/client-s3';
import { LocalStorageAdapter } from './local/local-storage.adapter';
import { R2StorageAdapter } from './r2/r2-storage.adapter';
import type { StorageConfig } from './storage.config';
import type { StorageService } from './storage.service';

export function createStorageAdapter(config: StorageConfig): StorageService {
  if (config.driver === 'r2') {
    if (!config.r2) {
      throw new Error('R2 config is missing');
    }
    return new R2StorageAdapter(
      new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
          accessKeyId: config.r2.accessKeyId,
          secretAccessKey: config.r2.secretAccessKey,
        },
      }),
      config.r2.bucket,
    );
  }

  return new LocalStorageAdapter({
    dir: config.local.dir,
    publicBaseUrl: config.local.publicBaseUrl,
    signingSecret: config.local.signingSecret,
  });
}
