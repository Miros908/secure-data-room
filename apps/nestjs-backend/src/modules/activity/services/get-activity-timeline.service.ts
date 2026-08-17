import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ActivityTimeline,
  ActivityTimelineQuery,
} from '@sdr/shared/activity';
import { ActivityRepository } from '../activity.repository';

export type GetActivityTimelineInput = ActivityTimelineQuery & {
  dataRoomId: string;
  userId: string;
};

@Injectable()
export class GetActivityTimelineService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async execute(input: GetActivityTimelineInput): Promise<ActivityTimeline> {
    const room = await this.activityRepository.findOwnedRoom(
      input.dataRoomId,
      input.userId,
    );

    if (!room) {
      throw new NotFoundException('not_found');
    }

    return this.activityRepository.listTimeline({
      roomId: room.id,
      cursor: input.cursor,
      limit: input.limit,
      actorKey: input.actorKey,
      type: input.type,
    });
  }
}
