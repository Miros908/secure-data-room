import { Prisma } from '../../../database/generated/prisma/client';
import { DEFAULT_DATA_ROOM_NAME } from '../data-rooms.constants';
import type { DataRoomsRepository } from '../data-rooms.repository';
import type { DataRoomRecord } from '../data-rooms.types';
import { CreateOwnedDataRoomService } from './create-owned-data-room.service';

const room: DataRoomRecord = {
  id: 'room-1',
  name: DEFAULT_DATA_ROOM_NAME,
  ownerId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('CreateOwnedDataRoomService', () => {
  const dataRoomsRepository = {
    findByOwnerId: jest.fn(),
    create: jest.fn(),
  };
  const service = new CreateOwnedDataRoomService(
    dataRoomsRepository as unknown as DataRoomsRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the existing room', async () => {
    dataRoomsRepository.findByOwnerId.mockResolvedValue(room);

    await expect(service.execute({ ownerId: 'user-1' })).resolves.toBe(room);
    expect(dataRoomsRepository.create).not.toHaveBeenCalled();
  });

  it('creates a room with the default name', async () => {
    dataRoomsRepository.findByOwnerId.mockResolvedValue(null);
    dataRoomsRepository.create.mockResolvedValue(room);

    await expect(service.execute({ ownerId: 'user-1' })).resolves.toBe(room);
    expect(dataRoomsRepository.create).toHaveBeenCalledWith({
      ownerId: 'user-1',
      name: DEFAULT_DATA_ROOM_NAME,
    });
  });

  it('returns the raced row on P2002', async () => {
    dataRoomsRepository.findByOwnerId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(room);
    dataRoomsRepository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.execute({ ownerId: 'user-1' })).resolves.toBe(room);
  });

  it('rethrows a non-unique create error', async () => {
    const boom = new Error('db down');
    dataRoomsRepository.findByOwnerId.mockResolvedValue(null);
    dataRoomsRepository.create.mockRejectedValue(boom);

    await expect(service.execute({ ownerId: 'user-1' })).rejects.toBe(boom);
  });
});
