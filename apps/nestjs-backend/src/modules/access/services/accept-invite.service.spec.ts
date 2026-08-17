import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import { hashShareToken } from '../utils/share-token';
import { AcceptInviteService } from './accept-invite.service';

const invite = {
  id: 'invite-1',
  email: 'a@example.com',
  role: 'viewer' as const,
  grantedById: 'owner-1',
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  fileId: null,
  expiresAt: new Date('2026-01-08T00:00:00.000Z'),
  accessExpiresAt: null,
};

describe('AcceptInviteService', () => {
  const accessRepository = {
    findPendingInviteByTokenHash: jest.fn(),
    findPendingInvitesByEmail: jest.fn(),
    acceptInvitation: jest.fn(),
    findFoldersMeta: jest.fn(),
    findFilesMeta: jest.fn(),
    findDataRooms: jest.fn(),
  };
  const activityRepository = {
    append: jest.fn(),
  };
  const eventsBroker = {
    publishToUser: jest.fn(),
    publishToDataRoom: jest.fn(),
  };
  const service = new AcceptInviteService(
    accessRepository as unknown as AccessRepository,
    activityRepository as unknown as import('../../activity/activity.repository').ActivityRepository,
    eventsBroker as unknown as import('../../events/events.broker').EventsBroker,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accessRepository.acceptInvitation.mockResolvedValue(undefined);
    accessRepository.findFoldersMeta.mockResolvedValue([{ name: 'Reports' }]);
    accessRepository.findFilesMeta.mockResolvedValue([]);
    accessRepository.findDataRooms.mockResolvedValue([]);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 for an unknown token', async () => {
    accessRepository.findPendingInviteByTokenHash.mockResolvedValue(null);

    await expect(
      service.execute({
        userId: 'user-1',
        email: 'a@example.com',
        token: 'ab'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 403 when the token email does not match the session', async () => {
    accessRepository.findPendingInviteByTokenHash.mockResolvedValue(invite);

    await expect(
      service.execute({
        userId: 'user-1',
        email: 'other@example.com',
        token: 'ab'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessRepository.acceptInvitation).not.toHaveBeenCalled();
  });

  it('accepts a matching token', async () => {
    const token = 'cd'.repeat(32);
    accessRepository.findPendingInviteByTokenHash.mockResolvedValue(invite);

    await expect(
      service.execute({
        userId: 'user-1',
        email: '  A@Example.com ',
        token,
      }),
    ).resolves.toEqual({ accepted: 1 });
    expect(accessRepository.findPendingInviteByTokenHash).toHaveBeenCalledWith(
      hashShareToken(token),
    );
    expect(accessRepository.acceptInvitation).toHaveBeenCalledWith(
      {
        invitationId: 'invite-1',
        userId: 'user-1',
        grantedById: 'owner-1',
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
        role: 'viewer',
        expiresAt: null,
      },
      expect.any(Function),
    );
    expect(eventsBroker.publishToUser).toHaveBeenCalledWith('user-1', {
      type: 'access_granted',
      dataRoomId: 'room-1',
      target: { kind: 'folder', id: 'folder-1' },
    });
  });

  it('accepts every pending invite for the session email', async () => {
    accessRepository.findPendingInvitesByEmail.mockResolvedValue([
      invite,
      { ...invite, id: 'invite-2', folderId: null },
    ]);

    await expect(
      service.execute({
        userId: 'user-1',
        email: ' A@Example.com ',
      }),
    ).resolves.toEqual({ accepted: 2 });
    expect(accessRepository.acceptInvitation).toHaveBeenCalledTimes(2);
  });
});
