import type { DataRoomsRepository } from '../data-rooms.repository';
import type { DataRoomRecord } from '../data-rooms.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { CreateOwnedDataRoomService } from './create-owned-data-room.service';
import { ListDataRoomsService } from './list-data-rooms.service';

const myRoom: DataRoomRecord = {
  id: 'room-mine',
  name: 'Мой диск',
  ownerId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
const shared: DataRoomRecord = {
  id: 'room-shared',
  name: 'Shared',
  ownerId: 'owner-2',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('ListDataRoomsService', () => {
  const dataRoomsRepository = { findManyByIds: jest.fn() };
  const createOwnedDataRoomService = { execute: jest.fn() };
  const resolveService = {
    listRoomLevelGrantedDataRoomIds: jest.fn(),
    execute: jest.fn(),
    resolveAccess: jest.fn(),
  };
  const service = new ListDataRoomsService(
    dataRoomsRepository as unknown as DataRoomsRepository,
    createOwnedDataRoomService as unknown as CreateOwnedDataRoomService,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    createOwnedDataRoomService.execute.mockResolvedValue(myRoom);
  });

  it('always includes the owned room and skips none/owner shared roles', async () => {
    resolveService.listRoomLevelGrantedDataRoomIds.mockResolvedValue([
      'room-mine',
      'room-shared',
      'room-none',
    ]);
    dataRoomsRepository.findManyByIds.mockResolvedValue([
      shared,
      {
        id: 'room-none',
        name: 'Hidden',
        ownerId: 'other',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ]);
    resolveService.resolveAccess.mockImplementation(
      async (params: { subject: { id: string } }) => {
        if (params.subject.id === 'room-shared') {
          return { role: 'editor', accessExpiresAt: null };
        }
        return { role: 'none', accessExpiresAt: null };
      },
    );

    const result = await service.execute({ userId: 'user-1' });

    expect(result.myRoom).toMatchObject({ id: 'room-mine', role: 'owner' });
    expect(result.sharedRooms).toEqual([
      {
        id: 'room-shared',
        name: 'Shared',
        role: 'editor',
        accessExpiresAt: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(dataRoomsRepository.findManyByIds).toHaveBeenCalledWith([
      'room-shared',
      'room-none',
    ]);
  });
});
