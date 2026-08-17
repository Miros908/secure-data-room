import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import type { AccessSubject } from '../access.types';
import { hashShareToken } from '../utils/share-token';
import { ResolveService } from './resolve.service';

const ownerId = 'owner-1';
const userId = 'user-1';
const folder: AccessSubject = {
  type: 'folder',
  id: 'folder-1',
  dataRoomId: 'room-1',
  ownerId,
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};
const file: AccessSubject = {
  type: 'file',
  id: 'file-1',
  dataRoomId: 'room-1',
  ownerId,
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};

describe('ResolveService', () => {
  const accessRepository = {
    findCoveringGrants: jest.fn(),
    findCoveringPublicLink: jest.fn(),
    findSubject: jest.fn(),
    findRoomLevelGrantedDataRoomIds: jest.fn(),
    findAccessibleDataRoomIds: jest.fn(),
  };
  const service = new ResolveService(
    accessRepository as unknown as AccessRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns owner without looking up grants', async () => {
    await expect(
      service.execute({ userId: ownerId, subject: folder }),
    ).resolves.toBe('owner');
    expect(accessRepository.findCoveringGrants).not.toHaveBeenCalled();
  });

  it('returns none for an anonymous session without looking up grants', async () => {
    await expect(
      service.execute({ userId: null, subject: folder }),
    ).resolves.toBe('none');
    expect(accessRepository.findCoveringGrants).not.toHaveBeenCalled();
  });

  it('returns the highest covering grant for a session user', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'viewer', expiresAt: null },
      { role: 'editor', expiresAt: null },
    ]);

    await expect(service.execute({ userId, subject: folder })).resolves.toBe(
      'editor',
    );
  });

  it('uses a public token only when the session role is none', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([]);
    accessRepository.findCoveringPublicLink.mockResolvedValue({
      expiresAt: null,
    });
    const token = 'ab'.repeat(32);

    await expect(
      service.execute({ userId, token, subject: folder }),
    ).resolves.toBe('viewer');
    expect(accessRepository.findCoveringPublicLink).toHaveBeenCalledWith({
      tokenHash: hashShareToken(token),
      dataRoomId: 'room-1',
      folderIds: expect.any(Array),
    });
  });

  it('does not let a public token raise an existing session role', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'editor', expiresAt: null },
    ]);
    accessRepository.findCoveringPublicLink.mockResolvedValue({
      expiresAt: null,
    });

    await expect(
      service.execute({
        userId,
        token: 'ab'.repeat(32),
        subject: folder,
      }),
    ).resolves.toBe('editor');
    expect(accessRepository.findCoveringPublicLink).not.toHaveBeenCalled();
  });

  it('uses a precomputed tokenHash without hashing again', async () => {
    accessRepository.findCoveringPublicLink.mockResolvedValue({
      expiresAt: null,
    });

    await expect(
      service.execute({
        userId: null,
        tokenHash: 'stored-hash',
        token: 'ignored',
        subject: file,
      }),
    ).resolves.toBe('viewer');
    expect(accessRepository.findCoveringPublicLink).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'stored-hash', fileId: 'file-1' }),
    );
  });

  it('assertCanRead throws 404 when the role is none', async () => {
    await expect(
      service.assertCanRead({ userId: null, subject: folder }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertCanWrite throws 403 for a viewer', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'viewer', expiresAt: null },
    ]);

    await expect(
      service.assertCanWrite({ userId, subject: folder }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertCanShare throws 403 for an editor', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'editor', expiresAt: null },
    ]);

    await expect(service.assertCanShare(userId, folder)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requireReadableSubject throws 404 when the subject is missing', async () => {
    accessRepository.findSubject.mockResolvedValue(null);

    await expect(
      service.requireReadableSubject('file', 'file-1', { userId }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requireWritableSubject returns the subject after a write check', async () => {
    accessRepository.findSubject.mockResolvedValue(folder);
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'editor', expiresAt: null },
    ]);

    await expect(
      service.requireWritableSubject('folder', 'folder-1', userId),
    ).resolves.toEqual({ subject: folder, role: 'editor' });
  });

  it('requireShareableSubject returns the access target for an owner', async () => {
    accessRepository.findSubject.mockResolvedValue(folder);

    await expect(
      service.requireShareableSubject(ownerId, 'folder', 'folder-1'),
    ).resolves.toEqual({
      subject: folder,
      target: {
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
      },
    });
  });

  it('returns null accessExpiresAt when a covering grant is unlimited', async () => {
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'viewer', expiresAt: new Date('2026-08-16T13:00:00.000Z') },
      { role: 'viewer', expiresAt: null },
    ]);
    accessRepository.findSubject.mockResolvedValue(folder);

    await expect(
      service.requireReadableSubject('folder', 'folder-1', { userId }),
    ).resolves.toEqual({
      subject: folder,
      role: 'viewer',
      accessExpiresAt: null,
    });
  });

  it('returns the latest covering expiry when every grant is timed', async () => {
    const later = new Date('2026-08-16T14:00:00.000Z');
    accessRepository.findCoveringGrants.mockResolvedValue([
      { role: 'viewer', expiresAt: new Date('2026-08-16T13:00:00.000Z') },
      { role: 'viewer', expiresAt: later },
    ]);
    accessRepository.findSubject.mockResolvedValue(folder);

    await expect(
      service.requireReadableSubject('folder', 'folder-1', { userId }),
    ).resolves.toEqual({
      subject: folder,
      role: 'viewer',
      accessExpiresAt: later,
    });
  });
});
