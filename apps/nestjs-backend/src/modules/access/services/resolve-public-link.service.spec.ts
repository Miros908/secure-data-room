import { NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import { hashShareToken } from '../utils/share-token';
import { ResolvePublicLinkService } from './resolve-public-link.service';

describe('ResolvePublicLinkService', () => {
  const accessRepository = {
    findActivePublicLinkByTokenHash: jest.fn(),
    findFoldersMeta: jest.fn(),
    findFilesMeta: jest.fn(),
    findDataRooms: jest.fn(),
  };
  const activityRepository = {
    append: jest.fn(),
  };
  const activityLive = { notifyOwner: jest.fn() };
  const service = new ResolvePublicLinkService(
    accessRepository as unknown as AccessRepository,
    activityRepository as unknown as import('../../activity/activity.repository').ActivityRepository,
    activityLive as unknown as import('../../activity/activity-live.publisher').ActivityLivePublisher,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accessRepository.findFoldersMeta.mockResolvedValue([{ name: 'Reports' }]);
    accessRepository.findFilesMeta.mockResolvedValue([]);
    accessRepository.findDataRooms.mockResolvedValue([]);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 for an unknown token', async () => {
    accessRepository.findActivePublicLinkByTokenHash.mockResolvedValue(null);

    await expect(
      service.execute({ token: 'ab'.repeat(32) }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(activityRepository.append).not.toHaveBeenCalled();
  });

  it('maps a hashed lookup to the subject and records LINK_OPENED', async () => {
    const token = 'cd'.repeat(32);
    accessRepository.findActivePublicLinkByTokenHash.mockResolvedValue({
      id: 'link-1',
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      fileId: null,
      expiresAt: null,
    });

    await expect(service.execute({ token, userId: 'user-1' })).resolves.toEqual(
      {
        type: 'folder',
        subjectId: 'folder-1',
        dataRoomId: 'room-1',
        accessExpiresAt: null,
      },
    );
    expect(
      accessRepository.findActivePublicLinkByTokenHash,
    ).toHaveBeenCalledWith(hashShareToken(token));
    expect(activityRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LINK_OPENED',
        dataRoomId: 'room-1',
        actorUserId: 'user-1',
        publicShareLinkId: 'link-1',
        folderId: 'folder-1',
        dedupe: true,
      }),
    );
    expect(activityLive.notifyOwner).toHaveBeenCalledWith({
      recorded: { id: 'event-1' },
      dataRoomId: 'room-1',
      actorUserId: 'user-1',
    });
  });
});
