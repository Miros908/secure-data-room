import { NotFoundException } from '@nestjs/common';
import type { FoldersRepository } from '../folders.repository';
import type { FolderRecord } from '../folders.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { ActivityRepository } from '../../activity/activity.repository';
import type { EventsBroker } from '../../events/events.broker';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { DeleteFolderService } from './delete-folder.service';

const folder: FolderRecord = {
  id: 'folder-1',
  name: 'Reports',
  parentId: null,
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  path: '/folder-1/',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DeleteFolderService', () => {
  const foldersRepository = {
    findById: jest.fn(),
    countSubtree: jest.fn(),
    listSubtreeStorageKeys: jest.fn(),
    deleteById: jest.fn(),
  };
  const resolveService = { requireWritableSubject: jest.fn() };
  const storage = { delete: jest.fn() };
  const eventsBroker = { publishToDataRoom: jest.fn() };
  const activityRepository = { append: jest.fn() };
  const service = new DeleteFolderService(
    foldersRepository as unknown as FoldersRepository,
    resolveService as unknown as ResolveService,
    storage as unknown as StorageService,
    eventsBroker as unknown as EventsBroker,
    activityRepository as unknown as ActivityRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'folder-1' },
      role: 'editor',
    });
    foldersRepository.findById.mockResolvedValue(folder);
    foldersRepository.countSubtree.mockResolvedValue({ folders: 3, files: 5 });
    foldersRepository.listSubtreeStorageKeys.mockResolvedValue([
      'room-1/a',
      'room-1/b',
    ]);
    foldersRepository.deleteById.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 when the folder is missing', async () => {
    foldersRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'folder-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eventsBroker.publishToDataRoom).not.toHaveBeenCalled();
  });

  it('returns subtree counts and deletes every storage key', async () => {
    storage.delete.mockRejectedValueOnce(new Error('first failed'));

    await expect(
      service.execute({ id: 'folder-1', userId: 'user-1' }),
    ).resolves.toEqual({
      ok: true,
      deletedFolders: 3,
      deletedFiles: 5,
    });
    expect(foldersRepository.deleteById).toHaveBeenCalledWith(
      'folder-1',
      expect.any(Function),
    );
    expect(eventsBroker.publishToDataRoom).toHaveBeenCalledWith('room-1', {
      type: 'resource_gone',
      reason: 'deleted',
      dataRoomId: 'room-1',
      subject: { kind: 'folder', id: 'folder-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith('room-1/a');
    expect(storage.delete).toHaveBeenCalledWith('room-1/b');
  });
});
