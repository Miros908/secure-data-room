import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import type { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { MoveFileService } from './move-file.service';

const file: FileRecord = {
  id: 'file-1',
  name: 'report.pdf',
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

describe('MoveFileService', () => {
  const filesRepository = {
    findById: jest.fn(),
    hasSiblingName: jest.fn(),
    move: jest.fn(),
  };
  const resolveService = {
    requireWritableSubject: jest.fn(),
  };
  const service = new MoveFileService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockImplementation(
      async (type: string, id: string) => ({
        subject: {
          id,
          dataRoomId:
            type === 'folder' && id === 'other-room-folder'
              ? 'room-2'
              : 'room-1',
        },
        role: 'editor',
      }),
    );
    filesRepository.findById.mockResolvedValue(file);
    filesRepository.hasSiblingName.mockResolvedValue(false);
    filesRepository.move.mockResolvedValue({ ...file, folderId: 'folder-2' });
  });

  it('returns 404 when the file row is gone after ACL', async () => {
    filesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        folderId: 'folder-2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is a no-op when the folder does not change', async () => {
    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        folderId: 'folder-1',
      }),
    ).resolves.toMatchObject({ id: 'file-1', folderId: 'folder-1' });
    expect(filesRepository.move).not.toHaveBeenCalled();
    expect(resolveService.requireWritableSubject).toHaveBeenCalledTimes(1);
  });

  it('rejects a destination in another data room', async () => {
    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        folderId: 'other-room-folder',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires room write access when moving to the root', async () => {
    filesRepository.move.mockResolvedValue({ ...file, folderId: null });

    await service.execute({
      id: 'file-1',
      userId: 'user-1',
      folderId: null,
    });

    expect(resolveService.requireWritableSubject).toHaveBeenCalledWith(
      'data_room',
      'room-1',
      'user-1',
    );
  });

  it('rejects a taken name in the destination', async () => {
    filesRepository.hasSiblingName.mockResolvedValue(true);

    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        folderId: 'folder-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a P2002 from move to name_taken', async () => {
    filesRepository.move.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        folderId: 'folder-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
