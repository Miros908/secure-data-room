import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActivitySummary } from '@sdr/shared/activity';
import { ActivityRepository } from '../activity.repository';

export type GetActivitySummaryInput = {
  dataRoomId: string;
  userId: string;
};

@Injectable()
export class GetActivitySummaryService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async execute(input: GetActivitySummaryInput): Promise<ActivitySummary> {
    const room = await this.activityRepository.findOwnedRoom(
      input.dataRoomId,
      input.userId,
    );

    if (!room) {
      throw new NotFoundException('not_found');
    }

    return this.activityRepository.summarize(room.id, room.ownerId);
  }
}
