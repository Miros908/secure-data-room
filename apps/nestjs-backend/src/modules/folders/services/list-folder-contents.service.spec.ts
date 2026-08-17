import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../../access/access.repository';
import type { ResolveService } from '../../access/services/resolve.service';
import type { FoldersRepository } from '../folders.repository';
import type { FolderRecord } from '../folders.types';
import { ListFolderContentsService } from './list-folder-contents.service';

const folder: FolderRecord = {
  id: 'folder-1',
  name: 'Reports',
  parentId: 'root',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  path: '/root/folder-1/',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const root: FolderRecord = {
  id: 'root',
  name: 'Root',
  parentId: null,
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  path: '/root/',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ListFolderContentsService', () => {
  const foldersRepository = {
    findById: jest.fn(),
    listChildFolders: jest.fn(),
    listChildFiles: jest.fn(),
    findManyByIds: jest.fn(),
  };
  const resolveService = {
    requireReadableSubject: jest.fn(),
    execute: jest.fn(),
  };
  const accessRepository = {
    findDataRooms: jest.fn(),
    findFoldersMeta: jest.fn(),
    listTargetCoverage: jest.fn(),
  };
  const service = new ListFolderContentsService(
    foldersRepository as unknown as FoldersRepository,
    resolveService as unknown as ResolveService,
    accessRepository as unknown as AccessRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    foldersRepository.listChildFolders.mockResolvedValue([]);
    foldersRepository.listChildFiles.mockResolvedValue([]);
    foldersRepository.findManyByIds.mockResolvedValue([root, folder]);
    accessRepository.findDataRooms.mockResolvedValue([
      { id: 'room-1', name: 'Мой диск' },
    ]);
    accessRepository.findFoldersMeta.mockResolvedValue([
      { id: 'root', name: 'Root' },
    ]);
    accessRepository.listTargetCoverage.mockResolvedValue([]);
  });

  it('requires a folder or a data room', async () => {
    await expect(service.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns 404 when the folder row is gone after ACL', async () => {
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'folder-1' },
      role: 'viewer',
    });
    foldersRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ folderId: 'folder-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omits breadcrumb ancestors the caller cannot read', async () => {
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'folder-1' },
      role: 'viewer',
    });
    foldersRepository.findById.mockResolvedValue(folder);
    resolveService.execute.mockImplementation(
      async (params: { subject: { id: string } }) =>
        params.subject.id === 'folder-1' ? 'viewer' : 'none',
    );

    const result = await service.execute({
      folderId: 'folder-1',
      userId: 'user-1',
    });

    expect(result.breadcrumbs).toEqual([{ id: 'folder-1', name: 'Reports' }]);
    expect(result.sharing).toBeUndefined();
    expect(accessRepository.listTargetCoverage).not.toHaveBeenCalled();
  });

  it('loads sharing coverage only for the owner', async () => {
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'folder-1' },
      role: 'owner',
    });
    foldersRepository.findById.mockResolvedValue(folder);
    foldersRepository.listChildFolders.mockResolvedValue([
      {
        id: 'child-1',
        name: 'Child',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    foldersRepository.listChildFiles.mockResolvedValue([
      {
        id: 'file-1',
        name: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4,
        versionCount: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    resolveService.execute.mockResolvedValue('owner');
    accessRepository.listTargetCoverage.mockResolvedValue([
      {
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
        peopleCount: 2,
        pendingCount: 0,
        hasPublicLink: true,
      },
    ]);

    const result = await service.execute({
      folderId: 'folder-1',
      userId: 'owner-1',
    });

    expect(result.role).toBe('owner');
    expect(result.sharing).toMatchObject({
      peopleCount: 2,
      hasPublicLink: true,
    });
    expect(accessRepository.listTargetCoverage).toHaveBeenCalled();
  });

  it('lists a data room root', async () => {
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'room-1' },
      role: 'editor',
    });

    const result = await service.execute({
      dataRoomId: 'room-1',
      userId: 'user-1',
    });

    expect(result.folder).toBeNull();
    expect(result.dataRoomId).toBe('room-1');
    expect(result.role).toBe('editor');
    expect(result.breadcrumbs).toEqual([]);
    expect(foldersRepository.listChildFolders).toHaveBeenCalledWith({
      dataRoomId: 'room-1',
      parentId: null,
    });
  });
});
