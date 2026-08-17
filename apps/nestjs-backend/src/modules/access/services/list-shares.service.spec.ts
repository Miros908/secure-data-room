import type { AccessRepository } from '../access.repository';
import type { AccessSubject } from '../access.types';
import { ListSharesService } from './list-shares.service';
import type { ResolveService } from './resolve.service';

const roomSubject: AccessSubject = {
  type: 'data_room',
  id: 'room-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: null,
  folderPath: null,
};
const folderSubject: AccessSubject = {
  type: 'folder',
  id: 'folder-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};
const roomTarget = {
  dataRoomId: 'room-1',
  folderId: null,
  fileId: null,
};
const folderTarget = {
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  fileId: null,
};

describe('ListSharesService', () => {
  const accessRepository = {
    listGrantsForTarget: jest.fn(),
    listPendingInvitesForTarget: jest.fn(),
    findActivePublicLink: jest.fn(),
    findFoldersMeta: jest.fn(),
    findDataRooms: jest.fn(),
  };
  const resolveService = {
    requireShareableSubject: jest.fn(),
  };
  const service = new ListSharesService(
    accessRepository as unknown as AccessRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accessRepository.listGrantsForTarget.mockResolvedValue([]);
    accessRepository.listPendingInvitesForTarget.mockResolvedValue([]);
    accessRepository.findActivePublicLink.mockResolvedValue(null);
  });

  it('returns no inherited layers for a data room', async () => {
    resolveService.requireShareableSubject.mockResolvedValue({
      subject: roomSubject,
      target: roomTarget,
    });

    const result = await service.execute({
      type: 'data_room',
      id: 'room-1',
      actorId: 'owner-1',
    });

    expect(result.inherited).toEqual([]);
    expect(accessRepository.findFoldersMeta).not.toHaveBeenCalled();
  });

  it('omits ancestor layers that have no shares', async () => {
    resolveService.requireShareableSubject.mockResolvedValue({
      subject: folderSubject,
      target: folderTarget,
    });
    accessRepository.findFoldersMeta.mockResolvedValue([
      {
        id: 'root',
        name: 'Root',
        path: '/root/',
        parentId: null,
        dataRoomId: 'room-1',
      },
    ]);
    accessRepository.findDataRooms.mockResolvedValue([
      { id: 'room-1', name: 'Мой диск' },
    ]);

    const result = await service.execute({
      type: 'folder',
      id: 'folder-1',
      actorId: 'owner-1',
    });

    expect(result.inherited).toEqual([]);
  });

  it('includes an ancestor layer that has a public link', async () => {
    resolveService.requireShareableSubject.mockResolvedValue({
      subject: folderSubject,
      target: folderTarget,
    });
    accessRepository.findFoldersMeta.mockResolvedValue([
      {
        id: 'root',
        name: 'Root',
        path: '/root/',
        parentId: null,
        dataRoomId: 'room-1',
      },
    ]);
    accessRepository.findDataRooms.mockResolvedValue([
      { id: 'room-1', name: 'Мой диск' },
    ]);
    accessRepository.findActivePublicLink.mockImplementation(async (input) => {
      if (input.folderId === 'root') {
        return {
          id: 'link-1',
          dataRoomId: 'room-1',
          folderId: 'root',
          fileId: null,
          expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        };
      }
      return null;
    });

    const result = await service.execute({
      type: 'folder',
      id: 'folder-1',
      actorId: 'owner-1',
    });

    expect(result.inherited).toEqual([
      {
        source: {
          type: 'folder',
          id: 'root',
          name: 'Root',
          dataRoomId: 'room-1',
        },
        grants: [],
        invitations: [],
        publicLink: {
          id: 'link-1',
          expiresAt: '2026-02-01T00:00:00.000Z',
        },
      },
    ]);
  });
});
