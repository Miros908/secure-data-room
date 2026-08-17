import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ActivityRepository } from '../../activity/activity.repository';
import type { EventsBroker } from '../../events/events.broker';
import type { AccessRepository } from '../access.repository';
import type { AccessSubject } from '../access.types';
import { GrantService } from './grant.service';
import type { ResolveService } from './resolve.service';

const ownerId = 'owner-1';
const actorId = 'actor-1';
const recipientId = 'user-2';
const subject: AccessSubject = {
  type: 'folder',
  id: 'folder-1',
  dataRoomId: 'room-1',
  ownerId,
  folderId: 'folder-1',
  folderPath: '/folder-1/',
};
const target = {
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  fileId: null,
};

describe('GrantService', () => {
  const accessRepository = {
    findActiveUser: jest.fn(),
    findActiveGrant: jest.fn(),
    createGrant: jest.fn(),
    findFoldersMeta: jest.fn(),
    findFilesMeta: jest.fn(),
    findDataRooms: jest.fn(),
    hasCoveringAncestorGrant: jest.fn(),
    hasCoveringAncestorInvite: jest.fn(),
  };
  const resolveService = {
    requireShareableSubject: jest.fn(),
  };
  const activityRepository = {
    append: jest.fn(),
  };
  const eventsBroker = {
    publishToUser: jest.fn(),
    publishToDataRoom: jest.fn(),
  };
  const service = new GrantService(
    accessRepository as unknown as AccessRepository,
    resolveService as unknown as ResolveService,
    activityRepository as unknown as ActivityRepository,
    eventsBroker as unknown as EventsBroker,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireShareableSubject.mockResolvedValue({
      subject,
      target,
    });
    accessRepository.findFoldersMeta.mockResolvedValue([{ name: 'Reports' }]);
    accessRepository.findFilesMeta.mockResolvedValue([]);
    accessRepository.findDataRooms.mockResolvedValue([]);
    accessRepository.hasCoveringAncestorGrant.mockResolvedValue(false);
    accessRepository.hasCoveringAncestorInvite.mockResolvedValue(false);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('rejects granting to self', async () => {
    await expect(
      service.execute({
        userId: actorId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects granting to the owner', async () => {
    await expect(
      service.execute({
        userId: ownerId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when the recipient is missing', async () => {
    accessRepository.findActiveUser.mockResolvedValue(null);

    await expect(
      service.execute({
        userId: recipientId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when a grant already exists', async () => {
    accessRepository.findActiveUser.mockResolvedValue({
      id: recipientId,
      email: 'b@example.com',
      name: 'Bob',
    });
    accessRepository.findActiveGrant.mockResolvedValue({ id: 'grant-1' });

    await expect(
      service.execute({
        userId: recipientId,
        role: 'editor',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });

  it('creates a grant and maps the subject ref', async () => {
    accessRepository.findActiveUser.mockResolvedValue({
      id: recipientId,
      email: 'b@example.com',
      name: 'Bob',
    });
    accessRepository.findActiveGrant.mockResolvedValue(null);
    accessRepository.createGrant.mockResolvedValue({
      id: 'grant-1',
      userId: recipientId,
      role: 'viewer',
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      fileId: null,
      expiresAt: null,
    });

    await expect(
      service.execute({
        userId: recipientId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).resolves.toEqual({
      id: 'grant-1',
      userId: recipientId,
      role: 'viewer',
      type: 'folder',
      subjectId: 'folder-1',
      expiresAt: null,
    });
    expect(accessRepository.createGrant).toHaveBeenCalledWith(
      {
        userId: recipientId,
        grantedById: actorId,
        role: 'viewer',
        expiresAt: null,
        ...target,
      },
      expect.any(Function),
    );
    expect(eventsBroker.publishToUser).toHaveBeenCalledWith(recipientId, {
      type: 'access_granted',
      dataRoomId: 'room-1',
      target: { kind: 'folder', id: 'folder-1' },
    });
    expect(eventsBroker.publishToDataRoom).toHaveBeenCalledWith('room-1', {
      type: 'access_granted',
      dataRoomId: 'room-1',
      target: { kind: 'folder', id: 'folder-1' },
    });
    expect(
      eventsBroker.publishToUser.mock.invocationCallOrder[0],
    ).toBeGreaterThan(accessRepository.createGrant.mock.invocationCallOrder[0]);
  });

  it('returns 409 when an ancestor grant already covers the recipient', async () => {
    accessRepository.findActiveUser.mockResolvedValue({
      id: recipientId,
      email: 'b@example.com',
      name: 'Bob',
    });
    accessRepository.findActiveGrant.mockResolvedValue(null);
    accessRepository.hasCoveringAncestorGrant.mockResolvedValue(true);

    await expect(
      service.execute({
        userId: recipientId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toMatchObject({ message: 'already_covered' });
    expect(accessRepository.createGrant).not.toHaveBeenCalled();
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });

  it('passes a parsed expiresAt through to createGrant', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    accessRepository.findActiveUser.mockResolvedValue({
      id: recipientId,
      email: 'b@example.com',
      name: 'Bob',
    });
    accessRepository.findActiveGrant.mockResolvedValue(null);
    accessRepository.createGrant.mockResolvedValue({
      id: 'grant-1',
      userId: recipientId,
      role: 'viewer',
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      fileId: null,
      expiresAt: new Date(expiresAt),
    });

    await expect(
      service.execute({
        userId: recipientId,
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
        expiresAt,
      }),
    ).resolves.toEqual({
      id: 'grant-1',
      userId: recipientId,
      role: 'viewer',
      type: 'folder',
      subjectId: 'folder-1',
      expiresAt,
    });
    expect(accessRepository.createGrant).toHaveBeenCalledWith(
      {
        userId: recipientId,
        grantedById: actorId,
        role: 'viewer',
        expiresAt: new Date(expiresAt),
        ...target,
      },
      expect.any(Function),
    );
  });
});
