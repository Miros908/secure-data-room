import { NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../../access/access.repository';
import type { ResolveService } from '../../access/services/resolve.service';
import type { ActivityLivePublisher } from '../activity-live.publisher';
import type { ActivityRepository } from '../activity.repository';
import { RecordFileViewService } from './record-file-view.service';

describe('RecordFileViewService', () => {
  const activityRepository = {
    findFileSnapshot: jest.fn(),
    append: jest.fn(),
  };
  const activityLive = { notifyOwner: jest.fn() };
  const resolveService = { requireReadableSubject: jest.fn() };
  const accessRepository = { findCoveringPublicLink: jest.fn() };
  const service = new RecordFileViewService(
    activityRepository as unknown as ActivityRepository,
    activityLive as unknown as ActivityLivePublisher,
    resolveService as unknown as ResolveService,
    accessRepository as unknown as AccessRepository,
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
    });
    activityRepository.findFileSnapshot.mockResolvedValue({
      id: 'file-1',
      name: 'report.pdf',
      dataRoomId: 'room-1',
      folderId: null,
      storageKey: 'k',
      mimeType: 'application/pdf',
    });
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 when the file row is gone after ACL', async () => {
    activityRepository.findFileSnapshot.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(activityRepository.append).not.toHaveBeenCalled();
  });

  it('records a session view without a public link', async () => {
    await expect(
      service.execute({ id: 'file-1', userId: 'user-1' }),
    ).resolves.toEqual({ ok: true });
    expect(activityRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FILE_VIEWED',
        actorUserId: 'user-1',
        publicShareLinkId: null,
        fileId: 'file-1',
        resourceName: 'report.pdf',
        dedupe: true,
      }),
    );
    expect(activityLive.notifyOwner).toHaveBeenCalledWith({
      recorded: { id: 'event-1' },
      dataRoomId: 'room-1',
      actorUserId: 'user-1',
    });
    expect(accessRepository.findCoveringPublicLink).not.toHaveBeenCalled();
  });

  it('attaches the covering public link for a token view', async () => {
    accessRepository.findCoveringPublicLink.mockResolvedValue({
      id: 'link-1',
      expiresAt: null,
    });

    await expect(
      service.execute({ id: 'file-1', token: 'ab'.repeat(32) }),
    ).resolves.toEqual({ ok: true });
    expect(activityRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        publicShareLinkId: 'link-1',
        dedupe: true,
      }),
    );
  });
});
