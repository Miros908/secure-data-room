import { toDataRoomResponse } from './to-data-room-response';

describe('toDataRoomResponse', () => {
  it('includes the visible role', () => {
    expect(
      toDataRoomResponse(
        {
          id: 'room-1',
          name: 'Мой диск',
          ownerId: 'owner-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        'editor',
      ),
    ).toEqual({
      id: 'room-1',
      name: 'Мой диск',
      role: 'editor',
      accessExpiresAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
