import { NotFoundException } from '@nestjs/common';
import type { ActivityRepository } from '../activity.repository';
import { GetActivityTimelineService } from './get-activity-timeline.service';

describe('GetActivityTimelineService', () => {
  const activityRepository = {
    findOwnedRoom: jest.fn(),
    listTimeline: jest.fn(),
  };
  const service = new GetActivityTimelineService(
    activityRepository as unknown as ActivityRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when the caller does not own the room', async () => {
    activityRepository.findOwnedRoom.mockResolvedValue(null);

    await expect(
      service.execute({ dataRoomId: 'room-1', userId: 'stranger' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(activityRepository.listTimeline).not.toHaveBeenCalled();
  });

  it('lists the timeline for an owned room', async () => {
    activityRepository.findOwnedRoom.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });
    activityRepository.listTimeline.mockResolvedValue({
      events: [],
      nextCursor: null,
    });

    await expect(
      service.execute({
        dataRoomId: 'room-1',
        userId: 'owner-1',
        actorKey: 'user:viewer-1',
      }),
    ).resolves.toEqual({ events: [], nextCursor: null });
    expect(activityRepository.listTimeline).toHaveBeenCalledWith({
      roomId: 'room-1',
      cursor: undefined,
      limit: undefined,
      actorKey: 'user:viewer-1',
      type: undefined,
    });
  });
});
