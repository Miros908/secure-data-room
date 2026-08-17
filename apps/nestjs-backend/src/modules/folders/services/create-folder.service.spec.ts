import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import { MAX_FOLDER_DEPTH } from '../folders.constants';
import type { FoldersRepository } from '../folders.repository';
import type { FolderRecord } from '../folders.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { CreateFolderService } from './create-folder.service';

const created: FolderRecord = {
  id: 'folder-new',
  name: 'Reports',
  parentId: 'parent-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  path: '/parent-1/folder-new/',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('CreateFolderService', () => {
  const foldersRepository = {
    hasSiblingName: jest.fn(),
    create: jest.fn(),
  };
  const resolveService = {
    requireWritableSubject: jest.fn(),
  };
  const service = new CreateFolderService(
    foldersRepository as unknown as FoldersRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    foldersRepository.hasSiblingName.mockResolvedValue(false);
    foldersRepository.create.mockResolvedValue(created);
  });

  it('requires a parent or a data room', async () => {
    await expect(
      service.execute({ userId: 'user-1', name: 'Reports' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a parent from another data room', async () => {
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: {
        id: 'parent-1',
        dataRoomId: 'room-1',
        folderPath: '/parent-1/',
      },
      role: 'editor',
    });

    await expect(
      service.execute({
        userId: 'user-1',
        name: 'Reports',
        parentId: 'parent-1',
        dataRoomId: 'room-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a folder deeper than the max depth', async () => {
    const ids = Array.from(
      { length: MAX_FOLDER_DEPTH },
      (_, index) =>
        `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: {
        id: ids[ids.length - 1],
        dataRoomId: 'room-1',
        folderPath: `/${ids.join('/')}/`,
      },
      role: 'editor',
    });

    await expect(
      service.execute({
        userId: 'user-1',
        name: 'Too deep',
        parentId: ids[ids.length - 1],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a taken sibling name', async () => {
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'room-1', dataRoomId: 'room-1', folderPath: null },
      role: 'owner',
    });
    foldersRepository.hasSiblingName.mockResolvedValue(true);

    await expect(
      service.execute({
        userId: 'user-1',
        name: 'Reports',
        dataRoomId: 'room-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a materialized path that is too long', async () => {
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: {
        id: 'parent-1',
        dataRoomId: 'room-1',
        folderPath: `/${'a'.repeat(2040)}/`,
      },
      role: 'editor',
    });

    await expect(
      service.execute({
        userId: 'user-1',
        name: 'Deep',
        parentId: 'parent-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates under a room root', async () => {
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'room-1', dataRoomId: 'room-1', folderPath: null },
      role: 'owner',
    });
    foldersRepository.create.mockImplementation(async (input) => ({
      ...created,
      id: input.id,
      parentId: input.parentId,
      path: input.path,
      name: input.name,
    }));

    const result = await service.execute({
      userId: 'user-1',
      name: '  Reports  ',
      dataRoomId: 'room-1',
    });

    expect(foldersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Reports',
        dataRoomId: 'room-1',
        parentId: null,
        path: expect.stringMatching(/^\/[0-9a-f-]{36}\/$/),
      }),
    );
    expect(result.name).toBe('Reports');
    expect(resolveService.requireWritableSubject).toHaveBeenCalledWith(
      'data_room',
      'room-1',
      'user-1',
    );
  });

  it('maps a P2002 from create to name_taken', async () => {
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'room-1', dataRoomId: 'room-1', folderPath: null },
      role: 'owner',
    });
    foldersRepository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.execute({
        userId: 'user-1',
        name: 'Reports',
        dataRoomId: 'room-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
