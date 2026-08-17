import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { contentDispositionHeader } from '../content-disposition';
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

export class R2StorageAdapter implements StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(input: PutObjectInput): Promise<void> {
    assertSafeStorageKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.body.length,
        ContentType: input.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    assertSafeStorageKey(key);
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!(object.Body instanceof Readable)) {
        throw new StorageNotFoundError(key);
      }
      return {
        body: object.Body,
        contentType: object.ContentType ?? 'application/octet-stream',
        contentLength: object.ContentLength ?? 0,
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new StorageNotFoundError(key);
      }
      throw error;
    }
  }

  async getDownloadUrl(
    key: string,
    input: DownloadUrlInput = {},
  ): Promise<DownloadUrl> {
    assertSafeStorageKey(key);
    const expiresInSeconds =
      input.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: input.contentType,
        ResponseContentDisposition: input.filename
          ? contentDispositionHeader(
              input.disposition ?? 'inline',
              input.filename,
            )
          : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresAt };
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return false;
  }
  const name = error.name;
  return name === 'NoSuchKey' || name === 'NotFound';
}
