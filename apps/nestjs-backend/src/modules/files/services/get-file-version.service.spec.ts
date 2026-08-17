import { NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FilesRepository } from '../files.repository';
import type { FileRecord, FileVersionRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { GetFileVersionService } from './get-file-version.service';

const file: FileRecord = {
  id: 'file-1',
  name: 'report.pdf',
  dataRoomId: 'room-1',
  folderId: null,
  mimeType: 'application/pdf',
  sizeBytes: 20,
  storageKey: 'room-1/file-1/version-2',
  currentVersionId: 'version-2',
  versionNumber: 2,
  versionCount: 2,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const oldVersion: FileVersionRecord = {
  id: 'version-1',
  fileId: 'file-1',
  versionNumber: 1,
  storageKey: 'room-1/file-1/version-1',
  mimeType: 'application/pdf',
  sizeBytes: 10,
  uploadedByName: 'Owner',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('GetFileVersionService', () => {
  const filesRepository = {
    findById: jest.fn(),
    findVersion: jest.fn(),
  };
  const resolveService = { requireReadableSubject: jest.fn() };
  const storage = { getDownloadUrl: jest.fn() };
  const service = new GetFileVersionService(
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
    filesRepository.findVersion.mockResolvedValue(oldVersion);
    storage.getDownloadUrl.mockResolvedValue({
      url: 'https://signed.example/v1',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });
  });

  it('returns 404 when the version does not belong to the file', async () => {
    filesRepository.findVersion.mockResolvedValue(null);

    await expect(
      service.execute({
        id: 'file-1',
        versionId: 'missing',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('signs the selected version key, not the current one', async () => {
    await expect(
      service.execute({
        id: 'file-1',
        versionId: 'version-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      id: 'file-1',
      versionNumber: 1,
      sizeBytes: 10,
      currentVersionId: 'version-2',
      downloadUrl: 'https://signed.example/v1',
    });
    expect(storage.getDownloadUrl).toHaveBeenCalledWith(
      'room-1/file-1/version-1',
      {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      },
    );
  });

  it('OBS-12 does not record a view when issuing a version preview URL', () => {
    const source = readFileSync(
      path.join(__dirname, 'get-file-version.service.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /ActivityRepository|FILE_VIEWED|activity_events/,
    );
  });
});
