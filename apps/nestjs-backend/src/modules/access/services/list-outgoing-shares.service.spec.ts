import type { AccessRepository } from '../access.repository';
import { ListOutgoingSharesService } from './list-outgoing-shares.service';

describe('ListOutgoingSharesService', () => {
  const accessRepository = {
    listOutgoingTargetStats: jest.fn(),
    findDataRooms: jest.fn(),
    findFilesMeta: jest.fn(),
    findFoldersMeta: jest.fn(),
  };
  const service = new ListOutgoingSharesService(
    accessRepository as unknown as AccessRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when there are no stats', async () => {
    accessRepository.listOutgoingTargetStats.mockResolvedValue([]);

    await expect(service.execute({ ownerId: 'owner-1' })).resolves.toEqual({
      items: [],
    });
    expect(accessRepository.findDataRooms).not.toHaveBeenCalled();
  });

  it('skips a row whose metadata is missing', async () => {
    accessRepository.listOutgoingTargetStats.mockResolvedValue([
      {
        dataRoomId: 'room-1',
        folderId: null,
        fileId: 'missing',
        peopleCount: 1,
        pendingCount: 0,
        hasPublicLink: false,
      },
    ]);
    accessRepository.findDataRooms.mockResolvedValue([]);
    accessRepository.findFilesMeta.mockResolvedValue([]);
    accessRepository.findFoldersMeta.mockResolvedValue([]);

    await expect(service.execute({ ownerId: 'owner-1' })).resolves.toEqual({
      items: [],
    });
  });

  it('maps room, folder and file items and sorts by name', async () => {
    accessRepository.listOutgoingTargetStats.mockResolvedValue([
      {
        dataRoomId: 'room-1',
        folderId: null,
        fileId: null,
        peopleCount: 2,
        pendingCount: 1,
        hasPublicLink: true,
      },
      {
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: null,
        peopleCount: 1,
        pendingCount: 0,
        hasPublicLink: false,
      },
      {
        dataRoomId: 'room-1',
        folderId: 'folder-1',
        fileId: 'file-1',
        peopleCount: 0,
        pendingCount: 1,
        hasPublicLink: false,
      },
    ]);
    accessRepository.findDataRooms.mockResolvedValue([
      { id: 'room-1', name: 'Яндекс' },
    ]);
    accessRepository.findFilesMeta.mockResolvedValue([
      {
        id: 'file-1',
        name: 'alpha.pdf',
        folderId: 'folder-1',
        dataRoomId: 'room-1',
      },
    ]);
    accessRepository.findFoldersMeta.mockImplementation(
      async (ids: string[]) => {
        const folders = [
          {
            id: 'folder-1',
            name: 'Beta',
            path: '/folder-1/',
            parentId: null,
            dataRoomId: 'room-1',
          },
        ];
        return folders.filter((folder) => ids.includes(folder.id));
      },
    );

    const result = await service.execute({ ownerId: 'owner-1' });
    const names = result.items.map((item) => item.name);

    expect(names).toEqual(
      [...names].sort((left, right) =>
        left.localeCompare(right, 'ru', { numeric: true, sensitivity: 'base' }),
      ),
    );
    expect(new Set(names)).toEqual(new Set(['alpha.pdf', 'Beta', 'Яндекс']));
    expect(result.items.find((item) => item.type === 'file')).toMatchObject({
      type: 'file',
      id: 'file-1',
      parentFolderId: 'folder-1',
    });
    expect(result.items.find((item) => item.type === 'folder')).toMatchObject({
      type: 'folder',
      id: 'folder-1',
      path: [{ id: 'folder-1', name: 'Beta' }],
    });
    expect(
      result.items.find((item) => item.type === 'data_room'),
    ).toMatchObject({
      type: 'data_room',
      id: 'room-1',
      path: [],
      hasPublicLink: true,
    });
  });
});
