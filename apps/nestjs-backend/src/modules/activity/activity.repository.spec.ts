import { ActivityEventType } from '../../database/generated/prisma/enums';
import type { PrismaService } from '../../database/prisma.service';
import { ActivityRepository } from './activity.repository';

describe('ActivityRepository.append', () => {
  const prisma = {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    activity_events: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const repository = new ActivityRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    prisma.activity_events.create.mockResolvedValue({ id: 'event-1' });
  });

  it('writes a row when there is no duplicate', async () => {
    prisma.activity_events.findFirst.mockResolvedValue(null);

    await expect(
      repository.append({
        type: ActivityEventType.FILE_VIEWED,
        dataRoomId: 'room-1',
        actorUserId: 'user-1',
        fileId: 'file-1',
        resourceName: 'report.pdf',
        dedupe: true,
      }),
    ).resolves.toEqual({ id: 'event-1' });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.activity_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data_room_id: 'room-1',
          type: ActivityEventType.FILE_VIEWED,
          actor_user_id: 'user-1',
          file_id: 'file-1',
          resource_name: 'report.pdf',
        }),
      }),
    );
  });

  it('skips a duplicate within the dedup window', async () => {
    prisma.activity_events.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      repository.append({
        type: ActivityEventType.FILE_VIEWED,
        dataRoomId: 'room-1',
        actorUserId: 'user-1',
        fileId: 'file-1',
        dedupe: true,
      }),
    ).resolves.toBeNull();
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.activity_events.create).not.toHaveBeenCalled();
  });

  it('does not look for duplicates when dedupe is off', async () => {
    await expect(
      repository.append({
        type: ActivityEventType.FILE_DOWNLOADED,
        dataRoomId: 'room-1',
        actorUserId: 'user-1',
        fileId: 'file-1',
      }),
    ).resolves.toEqual({ id: 'event-1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.activity_events.findFirst).not.toHaveBeenCalled();
  });
});
