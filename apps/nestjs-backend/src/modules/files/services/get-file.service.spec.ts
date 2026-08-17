import { NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { GetFileService } from './get-file.service';

const file: FileRecord = {
  id: 'file-1',
  name: 'report.pdf',
  dataRoomId: 'room-1',
  folderId: null,
  mimeType: 'application/pdf',
  sizeBytes: 10,
  storageKey: 'room-1/file-1/version-1',
  currentVersionId: 'version-1',
  versionNumber: 1,
  versionCount: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('GetFileService', () => {
  const filesRepository = { findById: jest.fn() };
  const resolveService = { requireReadableSubject: jest.fn() };
  const storage = { getDownloadUrl: jest.fn() };
  const service = new GetFileService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'file-1' },
      role: 'viewer',
    });
    filesRepository.findById.mockResolvedValue(file);
    storage.getDownloadUrl.mockResolvedValue({
      url: 'https://signed.example/file',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });
  });

  it('returns 404 when the file row is gone after ACL', async () => {
    filesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a visible role and signed download URL', async () => {
    await expect(
      service.execute({ id: 'file-1', userId: 'user-1', token: 't' }),
    ).resolves.toMatchObject({
      id: 'file-1',
      role: 'viewer',
      downloadUrl: 'https://signed.example/file',
      downloadUrlExpiresAt: '2026-01-01T00:15:00.000Z',
    });
    expect(storage.getDownloadUrl).toHaveBeenCalledWith(
      'room-1/file-1/version-1',
      {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      },
    );
  });

  it('OBS-12 does not record a view when issuing the preview URL', () => {
    const source = readFileSync(
      path.join(__dirname, 'get-file.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /ActivityRepository|FILE_VIEWED|activity_events/,
    );
  });
});
