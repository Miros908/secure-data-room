import { NotFoundException } from '@nestjs/common';
import type { DataRoomsRepository } from '../data-rooms.repository';
import type { DataRoomRecord } from '../data-rooms.types';
import type { ResolveService } from '../../access/services/resolve.service';
import { GetDataRoomService } from './get-data-room.service';

const room: DataRoomRecord = {
  id: 'room-1',
  name: 'Мой диск',
  ownerId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('GetDataRoomService', () => {
  const dataRoomsRepository = { findById: jest.fn() };
  const resolveService = { requireReadableSubject: jest.fn() };
  const service = new GetDataRoomService(
    dataRoomsRepository as unknown as DataRoomsRepository,
    resolveService as unknown as ResolveService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireReadableSubject.mockResolvedValue({
      subject: { id: 'room-1' },
      role: 'viewer',
    });
  });

  it('returns 404 when the room row is gone after ACL', async () => {
    dataRoomsRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ id: 'room-1', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps the room and visible role', async () => {
    dataRoomsRepository.findById.mockResolvedValue(room);

    await expect(
      service.execute({ id: 'room-1', userId: 'user-1' }),
    ).resolves.toEqual({
      id: 'room-1',
      name: 'Мой диск',
      role: 'viewer',
      accessExpiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
