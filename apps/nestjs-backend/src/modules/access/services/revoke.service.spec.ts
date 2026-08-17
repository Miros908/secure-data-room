import { NotFoundException } from '@nestjs/common';
import type { ActivityRepository } from '../../activity/activity.repository';
import type { EventsBroker } from '../../events/events.broker';
import type { AccessRepository } from '../access.repository';
import { RevokeService } from './revoke.service';
import type { ResolveService } from './resolve.service';

const target = {
  id: 'grant-1',
  userId: 'viewer-1',
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  fileId: null,
};

const liveTarget = {
  type: 'access_invalidated',
  reason: 'revoked',
  dataRoomId: 'room-1',
  target: { kind: 'folder', id: 'folder-1' },
};

describe('RevokeService', () => {
  const accessRepository = {
    findActiveGrantById: jest.fn(),
    findPendingInviteById: jest.fn(),
    findActivePublicLinkById: jest.fn(),
    revokeGrant: jest.fn(),
    revokeInvite: jest.fn(),
    revokePublicLink: jest.fn(),
    findFoldersMeta: jest.fn(),
    findFilesMeta: jest.fn(),
    findDataRooms: jest.fn(),
  };
  const resolveService = {
    requireShareableSubject: jest.fn(),
  };
  const eventsBroker = {
    publishToUser: jest.fn(),
    publishToPublicLink: jest.fn(),
    publishToDataRoom: jest.fn(),
  };
  const activityRepository = {
    append: jest.fn(),
  };
  const service = new RevokeService(
    accessRepository as unknown as AccessRepository,
    resolveService as unknown as ResolveService,
    eventsBroker as unknown as EventsBroker,
    activityRepository as unknown as ActivityRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireShareableSubject.mockResolvedValue({});
    accessRepository.findFoldersMeta.mockResolvedValue([{ name: 'Reports' }]);
    accessRepository.findFilesMeta.mockResolvedValue([{ name: 'file.pdf' }]);
    accessRepository.findDataRooms.mockResolvedValue([{ name: 'Room' }]);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 404 when the target is missing', async () => {
    accessRepository.findActiveGrantById.mockResolvedValue(null);

    await expect(
      service.execute({ kind: 'grant', id: 'grant-1', actorId: 'actor-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resolveService.requireShareableSubject).not.toHaveBeenCalled();
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });

  it('revokes a grant after a shareable check and notifies the recipient', async () => {
    accessRepository.findActiveGrantById.mockResolvedValue(target);
    accessRepository.revokeGrant.mockResolvedValue(true);

    await expect(
      service.execute({ kind: 'grant', id: 'grant-1', actorId: 'actor-1' }),
    ).resolves.toEqual({ ok: true });
    expect(resolveService.requireShareableSubject).toHaveBeenCalledWith(
      'actor-1',
      'folder',
      'folder-1',
    );
    expect(accessRepository.revokeGrant).toHaveBeenCalledWith(
      'grant-1',
      expect.any(Function),
    );
    expect(eventsBroker.publishToUser).toHaveBeenCalledWith(
      'viewer-1',
      liveTarget,
    );
    expect(
      eventsBroker.publishToUser.mock.invocationCallOrder[0],
    ).toBeGreaterThan(accessRepository.revokeGrant.mock.invocationCallOrder[0]);
  });

  it('revokes an invite without a live event', async () => {
    accessRepository.findPendingInviteById.mockResolvedValue({
      ...target,
      id: 'invite-1',
    });
    accessRepository.revokeInvite.mockResolvedValue(true);

    await expect(
      service.execute({ kind: 'invite', id: 'invite-1', actorId: 'actor-1' }),
    ).resolves.toEqual({ ok: true });
    expect(accessRepository.revokeInvite).toHaveBeenCalledWith(
      'invite-1',
      expect.any(Function),
    );
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
    expect(eventsBroker.publishToPublicLink).not.toHaveBeenCalled();
  });

  it('revokes a public link and notifies that link', async () => {
    accessRepository.findActivePublicLinkById.mockResolvedValue({
      ...target,
      id: 'link-1',
      fileId: 'file-1',
      folderId: null,
    });
    accessRepository.revokePublicLink.mockResolvedValue(true);

    await expect(
      service.execute({
        kind: 'public_link',
        id: 'link-1',
        actorId: 'actor-1',
      }),
    ).resolves.toEqual({ ok: true });
    expect(resolveService.requireShareableSubject).toHaveBeenCalledWith(
      'actor-1',
      'file',
      'file-1',
    );
    expect(accessRepository.revokePublicLink).toHaveBeenCalledWith(
      'link-1',
      expect.any(Function),
    );
    expect(eventsBroker.publishToPublicLink).toHaveBeenCalledWith('link-1', {
      type: 'access_invalidated',
      reason: 'revoked',
      dataRoomId: 'room-1',
      target: { kind: 'file', id: 'file-1' },
    });
  });

  it('returns 404 when revoke affects no row', async () => {
    accessRepository.findActiveGrantById.mockResolvedValue(target);
    accessRepository.revokeGrant.mockResolvedValue(false);

    await expect(
      service.execute({ kind: 'grant', id: 'grant-1', actorId: 'actor-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });
});
