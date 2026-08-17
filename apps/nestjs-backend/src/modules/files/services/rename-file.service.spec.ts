import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import type { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { RenameFileService } from './rename-file.service';

const file: FileRecord = {
  id: 'file-1',
  name: 'old.pdf',
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  mimeType: 'application/pdf',
  sizeBytes: 10,
  storageKey: 'room-1/file-1/version-1',
  currentVersionId: 'version-1',
  versionNumber: 1,
  versionCount: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('RenameFileService', () => {
  const filesRepository = {
    findById: jest.fn(),
    hasSiblingName: jest.fn(),
    rename: jest.fn(),
  };
  const resolveService = {
    requireWritableSubject: jest.fn(),
  };
  const service = new RenameFileService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'file-1' },
      role: 'editor',
    });
    filesRepository.findById.mockResolvedValue(file);
    filesRepository.hasSiblingName.mockResolvedValue(false);
    filesRepository.rename.mockResolvedValue({ ...file, name: 'new.pdf' });
  });

  it('returns 404 when the file is missing', async () => {
    filesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1', name: 'new.pdf' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sanitizes the name and excludes the current file from the unique check', async () => {
    await service.execute({
      id: 'file-1',
      userId: 'user-1',
      name: 'C:\\\\tmp\\\\new',
    });

    expect(filesRepository.hasSiblingName).toHaveBeenCalledWith({
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      name: 'new.pdf',
      excludeId: 'file-1',
    });
  });

  it('rejects a taken sibling name', async () => {
    filesRepository.hasSiblingName.mockResolvedValue(true);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1', name: 'new.pdf' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a P2002 from rename to name_taken', async () => {
    filesRepository.rename.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1', name: 'new.pdf' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
