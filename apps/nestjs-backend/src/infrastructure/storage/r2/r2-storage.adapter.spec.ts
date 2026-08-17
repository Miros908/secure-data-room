import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  StorageKeyInvalidError,
  StorageNotFoundError,
} from '../storage.errors';
import { DEFAULT_DOWNLOAD_TTL_SECONDS } from '../storage.service';
import { R2StorageAdapter } from './r2-storage.adapter';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const adapterSource = readFileSync(
  path.join(__dirname, 'r2-storage.adapter.ts'),
  'utf8',
);

describe('R2 adapter contract', () => {
  it('UP-03 uses only put/get/delete plus signed GET', () => {
    expect(adapterSource).toContain('PutObjectCommand');
    expect(adapterSource).toContain('GetObjectCommand');
    expect(adapterSource).toContain('DeleteObjectCommand');
    expect(adapterSource).not.toContain('ListObjects');
    expect(adapterSource).not.toContain('ListBuckets');
    expect(adapterSource).not.toContain('PutBucketAcl');
    expect(adapterSource).not.toContain('public-read');
  });

  it('UP-40 does not list the bucket as the app tree', () => {
    expect(adapterSource).not.toMatch(/ListObjectsV2Command/);
  });
});

describe('R2StorageAdapter', () => {
  const send = jest.fn();
  const adapter = new R2StorageAdapter(
    { send } as unknown as S3Client,
    'bucket',
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts an object into the configured bucket', async () => {
    send.mockResolvedValue({});

    await adapter.put({
      key: 'room-1/file-1',
      body: Buffer.from('%PDF'),
      contentType: 'application/pdf',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      Bucket: 'bucket',
      Key: 'room-1/file-1',
      ContentType: 'application/pdf',
      ContentLength: 4,
    });
  });

  it('rejects an unsafe key', async () => {
    await expect(
      adapter.put({
        key: '../escape',
        body: Buffer.from('x'),
        contentType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(StorageKeyInvalidError);
    expect(send).not.toHaveBeenCalled();
  });

  it('maps NoSuchKey to StorageNotFoundError', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
    );

    await expect(adapter.get('room-1/missing')).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
  });

  it('returns a readable body', async () => {
    const body = Readable.from([Buffer.from('hi')]);
    send.mockResolvedValue({
      Body: body,
      ContentType: 'application/pdf',
      ContentLength: 2,
    });

    const stored = await adapter.get('room-1/file-1');

    expect(stored.body).toBe(body);
    expect(stored.contentType).toBe('application/pdf');
    expect(stored.contentLength).toBe(2);
  });

  it('signs a GET URL with the default TTL', async () => {
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://signed.example/object');

    const result = await adapter.getDownloadUrl('room-1/file-1', {
      filename: 'a.pdf',
      contentType: 'application/pdf',
    });

    expect(result.url).toBe('https://signed.example/object');
    expect(jest.mocked(getSignedUrl).mock.calls[0][2]).toEqual({
      expiresIn: DEFAULT_DOWNLOAD_TTL_SECONDS,
    });
    const command = jest.mocked(getSignedUrl).mock.calls[0][1];
    expect(command).toBeInstanceOf(GetObjectCommand);
  });

  it('signs attachment Content-Disposition when requested', async () => {
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://signed.example/object');

    await adapter.getDownloadUrl('room-1/file-1', {
      filename: 'a.pdf',
      contentType: 'application/pdf',
      disposition: 'attachment',
    });

    const command = jest.mocked(getSignedUrl).mock
      .calls[0][1] as GetObjectCommand;
    expect(command.input.ResponseContentDisposition).toMatch(/^attachment;/);
  });
});
