import type { AccessRepository } from '../access.repository';
import { ListIncomingSharesService } from './list-incoming-shares.service';

describe('ListIncomingSharesService', () => {
  it('classifies room, folder and file grants', async () => {
    const accessRepository = {
      listIncomingGrants: jest.fn().mockResolvedValue([
        {
          role: 'viewer',
          dataRoomId: 'room-1',
          dataRoomName: 'Room',
          folder: null,
          file: null,
          expiresAt: null,
        },
        {
          role: 'editor',
          dataRoomId: 'room-1',
          dataRoomName: 'Room',
          folder: { id: 'folder-1', name: 'Reports' },
          file: null,
          expiresAt: new Date('2026-08-17T00:00:00.000Z'),
        },
        {
          role: 'viewer',
          dataRoomId: 'room-1',
          dataRoomName: 'Room',
          folder: null,
          file: { id: 'file-1', name: 'a.pdf' },
          expiresAt: null,
        },
      ]),
    };
    const service = new ListIncomingSharesService(
      accessRepository as unknown as AccessRepository,
    );

    await expect(service.execute({ userId: 'user-1' })).resolves.toEqual({
      rooms: [
        {
          id: 'room-1',
          name: 'Room',
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
      folders: [
        {
          id: 'folder-1',
          name: 'Reports',
          dataRoomId: 'room-1',
          role: 'editor',
          accessExpiresAt: '2026-08-17T00:00:00.000Z',
        },
      ],
      files: [
        {
          id: 'file-1',
          name: 'a.pdf',
          dataRoomId: 'room-1',
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
    });
  });
});
