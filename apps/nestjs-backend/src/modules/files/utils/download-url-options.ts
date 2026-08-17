import { MIN_SIGNED_URL_TTL_SECONDS } from '../../access/access.constants';
import { remainingAccessTtlSeconds } from '../../access/utils/access-expiry';
import {
  DEFAULT_DOWNLOAD_TTL_SECONDS,
  type DownloadUrlInput,
} from '../../../infrastructure/storage/storage.service';

export function downloadUrlOptions(
  filename: string,
  contentType: string,
  accessExpiresAt: Date | null | undefined,
  disposition: 'inline' | 'attachment' = 'inline',
): DownloadUrlInput {
  return {
    filename,
    contentType,
    ...(disposition === 'attachment' ? { disposition } : {}),
    ...(accessExpiresAt
      ? {
          expiresInSeconds: remainingAccessTtlSeconds(
            accessExpiresAt,
            DEFAULT_DOWNLOAD_TTL_SECONDS,
            MIN_SIGNED_URL_TTL_SECONDS,
          ),
        }
      : {}),
  };
}
