import { NotFoundException } from '@nestjs/common';
import type { ActivityRepository } from '../activity.repository';
import { GetActivitySummaryService } from './get-activity-summary.service';

describe('GetActivitySummaryService', () => {
  const activityRepository = {
    findOwnedRoom: jest.fn(),
    summarize: jest.fn(),
  };
  const service = new GetActivitySummaryService(
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
    expect(activityRepository.summarize).not.toHaveBeenCalled();
  });

  it('summarizes an owned room', async () => {
    activityRepository.findOwnedRoom.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });
    activityRepository.summarize.mockResolvedValue({
      visitors: [],
      topFiles: [],
      totals: { views: 0, downloads: 0, uniqueVisitors: 0, linkOpens: 0 },
    });

    await expect(
      service.execute({ dataRoomId: 'room-1', userId: 'owner-1' }),
    ).resolves.toMatchObject({ totals: { views: 0 } });
    expect(activityRepository.summarize).toHaveBeenCalledWith(
      'room-1',
      'owner-1',
    );
  });
});
