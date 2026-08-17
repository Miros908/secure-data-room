import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StorageNotFoundError } from '../storage.errors';
import { assertSafeStorageKey } from '../storage-key';
import {
  DEFAULT_DOWNLOAD_TTL_SECONDS,
  type DownloadUrl,
  type DownloadUrlInput,
  type PutObjectInput,
  type StorageService,
  type StoredObject,
} from '../storage.service';
import { signLocalDownloadUrl } from './local-download-url';

type LocalStorageOptions = {
  dir: string;
  publicBaseUrl: string;
  signingSecret: string;
};

export class LocalStorageAdapter implements StorageService {
  constructor(private readonly options: LocalStorageOptions) {}

  async put(input: PutObjectInput): Promise<void> {
    const filePath = this.resolvePath(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    await writeFile(
      metaPath(filePath),
      JSON.stringify({ contentType: input.contentType }),
      'utf8',
    );
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await unlink(filePath).catch(ignoreMissing);
    await unlink(metaPath(filePath)).catch(ignoreMissing);
  }

  async get(key: string): Promise<StoredObject> {
    const filePath = this.resolvePath(key);
    try {
      const info = await stat(filePath);
      return {
        body: createReadStream(filePath),
        contentType: await this.readContentType(filePath),
        contentLength: info.size,
      };
    } catch (error) {
      if (isMissing(error)) {
        throw new StorageNotFoundError(key);
      }
      throw error;
    }
  }

  getDownloadUrl(
    key: string,
    input: DownloadUrlInput = {},
  ): Promise<DownloadUrl> {
    this.resolvePath(key);
    return Promise.resolve(
      signLocalDownloadUrl({
        publicBaseUrl: this.options.publicBaseUrl,
        secret: this.options.signingSecret,
        key,
        filename: input.filename ?? 'file',
        contentType: input.contentType ?? 'application/octet-stream',
        expiresInSeconds:
          input.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS,
        disposition: input.disposition,
      }),
    );
  }

  private resolvePath(key: string): string {
    assertSafeStorageKey(key);
    const base = path.resolve(this.options.dir);
    const resolved = path.resolve(base, key);
    const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    if (resolved !== base && !resolved.startsWith(prefix)) {
      throw new StorageNotFoundError(key);
    }
    return resolved;
  }

  private async readContentType(filePath: string): Promise<string> {
    try {
      const raw = await readFile(metaPath(filePath), 'utf8');
      const parsed = JSON.parse(raw) as { contentType?: unknown };
      return typeof parsed.contentType === 'string'
        ? parsed.contentType
        : 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }
}

function metaPath(filePath: string): string {
  return `${filePath}.meta.json`;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function ignoreMissing(error: unknown): void {
  if (!isMissing(error)) {
    throw error;
  }
}
