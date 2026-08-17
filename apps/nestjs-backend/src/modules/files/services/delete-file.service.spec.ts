import { NotFoundException } from '@nestjs/common';
import type { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { ActivityRepository } from '../../activity/activity.repository';
import type { EventsBroker } from '../../events/events.broker';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { DeleteFileService } from './delete-file.service';

const file: FileRecord = {
  id: 'file-1',
  name: 'report.pdf',
  dataRoomId: 'room-1',
  folderId: null,
  mimeType: 'application/pdf',
  sizeBytes: 10,
  storageKey: 'room-1/file-1/version-2',
  currentVersionId: 'version-2',
  versionNumber: 2,
  versionCount: 2,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DeleteFileService', () => {
  const filesRepository = {
    findById: jest.fn(),
    listStorageKeys: jest.fn(),
    deleteById: jest.fn(),
  };
  const resolveService = { requireWritableSubject: jest.fn() };
  const storage = { delete: jest.fn() };
  const eventsBroker = { publishToDataRoom: jest.fn() };
  const activityRepository = { append: jest.fn() };
  const service = new DeleteFileService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
    storage as unknown as StorageService,
    eventsBroker as unknown as EventsBroker,
    activityRepository as unknown as ActivityRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'file-1' },
      role: 'editor',
    });
    filesRepository.findById.mockResolvedValue(file);
    filesRepository.listStorageKeys.mockResolvedValue([
      'room-1/file-1/version-1',
      'room-1/file-1/version-2',
    ]);
    filesRepository.deleteById.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 when the file is missing', async () => {
    filesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eventsBroker.publishToDataRoom).not.toHaveBeenCalled();
  });

  it('deletes the row then every version object, swallowing storage errors', async () => {
    storage.delete.mockRejectedValue(new Error('r2 down'));

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).resolves.toEqual({ ok: true });
    expect(filesRepository.deleteById).toHaveBeenCalledWith(
      'file-1',
      expect.any(Function),
    );
    expect(eventsBroker.publishToDataRoom).toHaveBeenCalledWith('room-1', {
      type: 'resource_gone',
      reason: 'deleted',
      dataRoomId: 'room-1',
      subject: { kind: 'file', id: 'file-1' },
    });
    expect(
      eventsBroker.publishToDataRoom.mock.invocationCallOrder[0],
    ).toBeGreaterThan(filesRepository.deleteById.mock.invocationCallOrder[0]);
    expect(storage.delete).toHaveBeenCalledWith('room-1/file-1/version-1');
    expect(storage.delete).toHaveBeenCalledWith('room-1/file-1/version-2');
  });
});
