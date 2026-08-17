import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import { hashShareToken } from '../utils/share-token';
import { InviteService } from './invite.service';
import type { GrantService } from './grant.service';
import type { ResolveService } from './resolve.service';

const actorId = 'actor-1';
const ownerId = 'owner-1';
const subject = {
  type: 'folder' as const,
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

describe('InviteService', () => {
  const accessRepository = {
    findActiveUser: jest.fn(),
    findUserByEmail: jest.fn(),
    findPendingInvite: jest.fn(),
    hasCoveringAncestorGrant: jest.fn(),
    hasCoveringAncestorInvite: jest.fn(),
    createInvite: jest.fn(),
  };
  const grantService = {
    execute: jest.fn(),
  };
  const resolveService = {
    requireShareableSubject: jest.fn(),
  };
  const service = new InviteService(
    accessRepository as unknown as AccessRepository,
    grantService as unknown as GrantService,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireShareableSubject.mockResolvedValue({
      subject,
      target,
    });
    accessRepository.findActiveUser.mockImplementation(async (id: string) => {
      if (id === actorId) {
        return { id: actorId, email: 'actor@example.com', name: 'Actor' };
      }
      if (id === ownerId) {
        return { id: ownerId, email: 'owner@example.com', name: 'Owner' };
      }
      return null;
    });
    accessRepository.hasCoveringAncestorGrant.mockResolvedValue(false);
    accessRepository.hasCoveringAncestorInvite.mockResolvedValue(false);
  });

  it('rejects inviting self', async () => {
    await expect(
      service.execute({
        email: ' Actor@Example.com ',
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inviting the owner', async () => {
    await expect(
      service.execute({
        email: 'owner@example.com',
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates to GrantService when the recipient already exists', async () => {
    accessRepository.findUserByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'b@example.com',
      name: 'Bob',
    });
    grantService.execute.mockResolvedValue({
      id: 'grant-1',
      userId: 'user-2',
      role: 'viewer',
      type: 'folder',
      subjectId: 'folder-1',
      expiresAt: null,
    });

    const result = await service.execute({
      email: 'b@example.com',
      role: 'viewer',
      type: 'folder',
      id: 'folder-1',
      grantedById: actorId,
    });

    expect(grantService.execute).toHaveBeenCalledWith({
      userId: 'user-2',
      role: 'viewer',
      type: 'folder',
      id: 'folder-1',
      expiresAt: undefined,
      grantedById: actorId,
    });
    expect(accessRepository.createInvite).not.toHaveBeenCalled();
    expect(result.id).toBe('grant-1');
    expect(result.email).toBe('b@example.com');
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.accessExpiresAt).toBeNull();
  });

  it('rejects a pending invite for the same email and target', async () => {
    accessRepository.findUserByEmail.mockResolvedValue(null);
    accessRepository.findPendingInvite.mockResolvedValue({ id: 'invite-1' });

    await expect(
      service.execute({
        email: 'new@example.com',
        role: 'editor',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores the invite token hash, not the raw token', async () => {
    accessRepository.findUserByEmail.mockResolvedValue(null);
    accessRepository.findPendingInvite.mockResolvedValue(null);
    accessRepository.createInvite.mockImplementation(async (input) => ({
      id: 'invite-1',
      email: input.email,
      role: input.role,
      grantedById: input.grantedById,
      dataRoomId: input.dataRoomId,
      folderId: input.folderId,
      fileId: input.fileId,
      expiresAt: input.expiresAt,
      accessExpiresAt: input.accessExpiresAt,
    }));

    const result = await service.execute({
      email: ' New@Example.com ',
      role: 'editor',
      type: 'folder',
      id: 'folder-1',
      grantedById: actorId,
    });

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(accessRepository.createInvite).toHaveBeenCalledWith({
      email: 'new@example.com',
      grantedById: actorId,
      tokenHash: hashShareToken(result.token),
      role: 'editor',
      expiresAt: expect.any(Date),
      accessExpiresAt: null,
      ...target,
    });
    expect(result).toMatchObject({
      id: 'invite-1',
      email: 'new@example.com',
      role: 'editor',
      type: 'folder',
      subjectId: 'folder-1',
      accessExpiresAt: null,
    });
  });

  it('returns 409 when an ancestor invite already covers the email', async () => {
    accessRepository.findUserByEmail.mockResolvedValue(null);
    accessRepository.findPendingInvite.mockResolvedValue(null);
    accessRepository.hasCoveringAncestorInvite.mockResolvedValue(true);

    await expect(
      service.execute({
        email: 'new@example.com',
        role: 'viewer',
        type: 'folder',
        id: 'folder-1',
        grantedById: actorId,
      }),
    ).rejects.toMatchObject({ message: 'already_covered' });
    expect(accessRepository.createInvite).not.toHaveBeenCalled();
  });
});
