import { NotFoundException } from '@nestjs/common';
import type { FilesRepository } from '../files.repository';
import type { FileRecord, FileVersionRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { ListFileVersionsService } from './list-file-versions.service';

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

const versions: FileVersionRecord[] = [
  {
    id: 'version-2',
    fileId: 'file-1',
    versionNumber: 2,
    storageKey: 'room-1/file-1/version-2',
    mimeType: 'application/pdf',
    sizeBytes: 20,
    uploadedByName: 'Owner',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  {
    id: 'version-1',
    fileId: 'file-1',
    versionNumber: 1,
    storageKey: 'room-1/file-1/version-1',
    mimeType: 'application/pdf',
    sizeBytes: 10,
    uploadedByName: 'Owner',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

describe('ListFileVersionsService', () => {
  const filesRepository = {
    findById: jest.fn(),
    listVersions: jest.fn(),
  };
  const resolveService = { requireReadableSubject: jest.fn() };
  const service = new ListFileVersionsService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'file-1' },
      role: 'viewer',
    });
    filesRepository.findById.mockResolvedValue(file);
    filesRepository.listVersions.mockResolvedValue(versions);
  });

  it('returns 404 when the file is missing after ACL', async () => {
    filesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists versions newest first without signed URLs', async () => {
    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).resolves.toEqual({
      versions: [
        {
          id: 'version-2',
          versionNumber: 2,
          sizeBytes: 20,
          createdAt: '2026-01-02T00:00:00.000Z',
          uploadedByName: 'Owner',
        },
        {
          id: 'version-1',
          versionNumber: 1,
          sizeBytes: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
          uploadedByName: 'Owner',
        },
      ],
    });
  });
});
