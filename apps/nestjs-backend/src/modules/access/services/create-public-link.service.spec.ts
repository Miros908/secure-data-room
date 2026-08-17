import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AccessRepository } from '../access.repository';
import { hashShareToken } from '../utils/share-token';
import { CreatePublicLinkService } from './create-public-link.service';
import type { ResolveService } from './resolve.service';

const target = {
  dataRoomId: 'room-1',
  folderId: null,
  fileId: 'file-1',
};

describe('CreatePublicLinkService', () => {
  const accessRepository = {
    findActivePublicLink: jest.fn(),
    createPublicLink: jest.fn(),
    findFoldersMeta: jest.fn(),
    findFilesMeta: jest.fn(),
    findDataRooms: jest.fn(),
  };
  const resolveService = {
    requireShareableSubject: jest.fn(),
  };
  const activityRepository = {
    append: jest.fn(),
  };
  const eventsBroker = {
    publishToDataRoom: jest.fn(),
  };
  const service = new CreatePublicLinkService(
    accessRepository as unknown as AccessRepository,
    resolveService as unknown as ResolveService,
    activityRepository as unknown as import('../../activity/activity.repository').ActivityRepository,
    eventsBroker as unknown as import('../../events/events.broker').EventsBroker,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireShareableSubject.mockResolvedValue({ target });
    accessRepository.findFilesMeta.mockResolvedValue([{ name: 'file.pdf' }]);
    accessRepository.findFoldersMeta.mockResolvedValue([]);
    accessRepository.findDataRooms.mockResolvedValue([]);
    activityRepository.append.mockResolvedValue({ id: 'event-1' });
  });

  it('rejects a second active link', async () => {
    accessRepository.findActivePublicLink.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.execute({
        type: 'file',
        id: 'file-1',
        createdById: 'owner-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an expiry in the past', async () => {
    accessRepository.findActivePublicLink.mockResolvedValue(null);

    await expect(
      service.execute({
        type: 'file',
        id: 'file-1',
        createdById: 'owner-1',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expiry further than one year', async () => {
    accessRepository.findActivePublicLink.mockResolvedValue(null);

    await expect(
      service.execute({
        type: 'file',
        id: 'file-1',
        createdById: 'owner-1',
        expiresAt: new Date(
          Date.now() + 366 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the hash and returns the raw token once', async () => {
    accessRepository.findActivePublicLink.mockResolvedValue(null);
    const expiresAt = new Date(Date.now() + 60_000);
    accessRepository.createPublicLink.mockImplementation(async (input) => ({
      id: 'link-1',
      dataRoomId: 'room-1',
      folderId: null,
      fileId: 'file-1',
      expiresAt: input.expiresAt,
    }));

    const result = await service.execute({
      type: 'file',
      id: 'file-1',
      createdById: 'owner-1',
      expiresAt: expiresAt.toISOString(),
    });

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(accessRepository.createPublicLink).toHaveBeenCalledWith(
      {
        createdById: 'owner-1',
        tokenHash: hashShareToken(result.token),
        expiresAt: expect.any(Date),
        ...target,
      },
      expect.any(Function),
    );
    expect(result).toMatchObject({
      id: 'link-1',
      type: 'file',
      subjectId: 'file-1',
    });
    expect(eventsBroker.publishToDataRoom).toHaveBeenCalledWith('room-1', {
      type: 'access_granted',
      dataRoomId: 'room-1',
      target: { kind: 'file', id: 'file-1' },
    });
  });

  it('allows a link without expiry', async () => {
    accessRepository.findActivePublicLink.mockResolvedValue(null);
    accessRepository.createPublicLink.mockResolvedValue({
      id: 'link-1',
      dataRoomId: 'room-1',
      folderId: null,
      fileId: 'file-1',
      expiresAt: null,
    });

    const result = await service.execute({
      type: 'file',
      id: 'file-1',
      createdById: 'owner-1',
    });

    expect(result.expiresAt).toBeNull();
    expect(accessRepository.createPublicLink.mock.calls[0][0].expiresAt).toBe(
      null,
    );
  });
});
