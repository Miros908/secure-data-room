import { NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../../access/access.repository';
import type { ResolveService } from '../../access/services/resolve.service';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import type { ActivityLivePublisher } from '../activity-live.publisher';
import type { ActivityRepository } from '../activity.repository';
import { RecordFileDownloadService } from './record-file-download.service';

describe('RecordFileDownloadService', () => {
  const activityRepository = {
    findFileSnapshot: jest.fn(),
    findFileVersionSnapshot: jest.fn(),
    append: jest.fn(),
  };
  const activityLive = { notifyOwner: jest.fn() };
  const resolveService = { requireReadableSubject: jest.fn() };
  const accessRepository = { findCoveringPublicLink: jest.fn() };
  const storage = { getDownloadUrl: jest.fn() };
  const service = new RecordFileDownloadService(
    activityRepository as unknown as ActivityRepository,
    activityLive as unknown as ActivityLivePublisher,
    resolveService as unknown as ResolveService,
    accessRepository as unknown as AccessRepository,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: {
        id: 'file-1',
        type: 'file',
        dataRoomId: 'room-1',
        folderId: null,
      },
      accessExpiresAt: null,
    });
    activityRepository.findFileSnapshot.mockResolvedValue({
      id: 'file-1',
      name: 'report.pdf',
      dataRoomId: 'room-1',
      folderId: null,
      storageKey: 'room-1/file-1/v2',
      mimeType: 'application/pdf',
    });
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
    storage.getDownloadUrl.mockResolvedValue({
      url: 'https://signed.example/dl',
      expiresAt: new Date('2026-01-01T00:15:00.000Z'),
    });
  });

  it('returns 404 when the file is missing', async () => {
    activityRepository.findFileSnapshot.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(activityRepository.append).not.toHaveBeenCalled();
  });

  it('records every download and signs an attachment URL', async () => {
    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).resolves.toEqual({
      downloadUrl: 'https://signed.example/dl',
      downloadUrlExpiresAt: '2026-01-01T00:15:00.000Z',
    });
    expect(activityRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILE_DOWNLOADED',
        fileId: 'file-1',
        actorUserId: 'user-1',
      }),
    );
    expect(activityRepository.append.mock.calls[0][0].dedupe).toBeUndefined();
    expect(activityLive.notifyOwner).toHaveBeenCalledWith({
      recorded: { id: 'event-1' },
      dataRoomId: 'room-1',
      actorUserId: 'user-1',
    });
    expect(storage.getDownloadUrl).toHaveBeenCalledWith('room-1/file-1/v2', {
      filename: 'report.pdf',
      contentType: 'application/pdf',
      disposition: 'attachment',
    });
  });

  it('returns 404 when the requested version is missing', async () => {
    activityRepository.findFileVersionSnapshot.mockResolvedValue(null);

    await expect(
      service.execute({
        id: 'file-1',
        userId: 'user-1',
        versionId: 'version-missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
