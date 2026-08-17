import type { DataRoomRecord } from '../data-rooms.types';
import type { CreateOwnedDataRoomService } from './create-owned-data-room.service';
import { GetMyDataRoomService } from './get-my-data-room.service';

describe('GetMyDataRoomService', () => {
  it('returns the owned room as owner', async () => {
    const room: DataRoomRecord = {
      id: 'room-1',
      name: 'Мой диск',
      ownerId: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const createOwnedDataRoomService = {
      execute: jest.fn().mockResolvedValue(room),
    };
    const service = new GetMyDataRoomService(
      createOwnedDataRoomService as unknown as CreateOwnedDataRoomService,
    );

    await expect(service.execute({ userId: 'user-1' })).resolves.toEqual({
      id: 'room-1',
      name: 'Мой диск',
      role: 'owner',
      accessExpiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
