import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import type { FoldersRepository } from '../folders.repository';
import type { FolderRecord } from '../folders.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { RenameFolderService } from './rename-folder.service';

const folder: FolderRecord = {
  id: 'folder-1',
  name: 'Old',
  parentId: null,
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  path: '/folder-1/',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('RenameFolderService', () => {
  const foldersRepository = {
    findById: jest.fn(),
    hasSiblingName: jest.fn(),
    rename: jest.fn(),
  };
  const resolveService = {
    requireWritableSubject: jest.fn(),
  };
  const service = new RenameFolderService(
    foldersRepository as unknown as FoldersRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'folder-1' },
      role: 'editor',
    });
    foldersRepository.findById.mockResolvedValue(folder);
    foldersRepository.hasSiblingName.mockResolvedValue(false);
    foldersRepository.rename.mockResolvedValue({ ...folder, name: 'New' });
  });

  it('returns 404 when the folder is missing', async () => {
    foldersRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'folder-1', userId: 'user-1', name: 'New' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes the name and excludes the current folder', async () => {
    await service.execute({
      id: 'folder-1',
      userId: 'user-1',
      name: '  New  ',
    });

    expect(foldersRepository.hasSiblingName).toHaveBeenCalledWith({
      dataRoomId: 'room-1',
      parentId: null,
      name: 'New',
      excludeId: 'folder-1',
    });
  });

  it('rejects a taken sibling name', async () => {
    foldersRepository.hasSiblingName.mockResolvedValue(true);

    await expect(
      service.execute({ id: 'folder-1', userId: 'user-1', name: 'New' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a P2002 from rename to name_taken', async () => {
    foldersRepository.rename.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.execute({ id: 'folder-1', userId: 'user-1', name: 'New' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
