import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import {
  StorageKeyInvalidError,
  StorageNotFoundError,
} from '../storage.errors';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  let dir: string;
  let storage: LocalStorageAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'sdr-storage-'));
    storage = new LocalStorageAdapter({
      dir,
      publicBaseUrl: 'http://localhost:4000',
      signingSecret: 'test-secret',
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes, reads and deletes an object', async () => {
    const key = 'rooms/abc/files/def/v1.pdf';
    const body = Buffer.from('%PDF-1.4 test');

    await storage.put({
      key,
      body,
      contentType: 'application/pdf',
    });

    const stored = await storage.get(key);
    const received = await buffer(stored.body);

    expect(received.equals(body)).toBe(true);
    expect(stored.contentType).toBe('application/pdf');
    expect(stored.contentLength).toBe(body.length);

    await storage.delete(key);
    await expect(storage.get(key)).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it('DEL-10 deleting a missing object is an idempotent success', async () => {
    await expect(
      storage.delete('rooms/missing/file.pdf'),
    ).resolves.toBeUndefined();
    await expect(
      storage.delete('rooms/missing/file.pdf'),
    ).resolves.toBeUndefined();
  });

  it('rejects a key that would escape the storage directory', async () => {
    await expect(
      storage.put({
        key: '../outside.txt',
        body: Buffer.from('nope'),
        contentType: 'text/plain',
      }),
    ).rejects.toBeInstanceOf(StorageKeyInvalidError);
  });

  it('issues a download URL that points at the local endpoint', async () => {
    const { url, expiresAt } = await storage.getDownloadUrl('a/b.txt', {
      filename: 'Договор.txt',
      contentType: 'text/plain',
      expiresInSeconds: 60,
    });

    expect(url.startsWith('http://localhost:4000/storage/objects?')).toBe(true);
    expect(url).toContain('key=a%2Fb.txt');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('includes disposition on an attachment URL', async () => {
    const { url } = await storage.getDownloadUrl('a/b.txt', {
      filename: 'Договор.txt',
      contentType: 'text/plain',
      disposition: 'attachment',
    });

    expect(url).toContain('disposition=attachment');
  });

  it('keeps sibling files intact when deleting', async () => {
    await storage.put({
      key: 'a/one.txt',
      body: Buffer.from('one'),
      contentType: 'text/plain',
    });
    await storage.put({
      key: 'a/two.txt',
      body: Buffer.from('two'),
      contentType: 'text/plain',
    });

    await storage.delete('a/one.txt');

    const leftover = await readFile(path.join(dir, 'a/two.txt'), 'utf8');
    expect(leftover).toBe('two');
  });
});
