import {
  ForbiddenException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { LocalStorageController } from './local-storage.controller';
import { signLocalDownloadUrl } from './local-download-url';
import { StorageNotFoundError } from '../storage.errors';
import type { StorageConfig } from '../storage.config';
import type { StorageService } from '../storage.service';

const secret = 'test-secret';
const localConfig: StorageConfig = {
  driver: 'local',
  keyPrefix: '',
  local: {
    dir: '/tmp/sdr',
    publicBaseUrl: 'http://localhost:4000',
    signingSecret: secret,
  },
  r2: null,
};

function signedQuery() {
  const { url } = signLocalDownloadUrl({
    publicBaseUrl: 'http://localhost:4000',
    secret,
    key: 'room-1/file-1',
    filename: 'a.pdf',
    contentType: 'application/pdf',
    expiresInSeconds: 60,
  });
  return Object.fromEntries(new URL(url).searchParams.entries());
}

describe('LocalStorageController', () => {
  const storage = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage.get.mockResolvedValue({
      body: Readable.from([Buffer.from('%PDF')]),
      contentType: 'application/pdf',
      contentLength: 4,
    });
  });

  it('returns 404 when the driver is not local', async () => {
    const controller = new LocalStorageController(
      storage as unknown as StorageService,
      { ...localConfig, driver: 'r2' },
    );

    await expect(controller.download(signedQuery())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('returns 403 for a bad signature', async () => {
    const controller = new LocalStorageController(
      storage as unknown as StorageService,
      localConfig,
    );
    const query = signedQuery();
    query.sig = 'deadbeef';

    await expect(controller.download(query)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 404 when the object is missing', async () => {
    storage.get.mockRejectedValue(new StorageNotFoundError('room-1/file-1'));
    const controller = new LocalStorageController(
      storage as unknown as StorageService,
      localConfig,
    );

    await expect(controller.download(signedQuery())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('streams a signed object', async () => {
    const controller = new LocalStorageController(
      storage as unknown as StorageService,
      localConfig,
    );

    const result = await controller.download(signedQuery());

    expect(result).toBeInstanceOf(StreamableFile);
    expect(storage.get).toHaveBeenCalledWith('room-1/file-1');
  });
});
