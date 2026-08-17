import { Injectable } from '@nestjs/common';
import type { LiveEvent } from '@sdr/shared/events';
import { EventsBroker } from '../events/events.broker';
import { ActivityRepository } from './activity.repository';

@Injectable()
export class ActivityLivePublisher {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly eventsBroker: EventsBroker,
  ) {}

  async notifyOwner(input: {
    recorded: { id: string } | null;
    dataRoomId: string;
    actorUserId?: string | null;
  }): Promise<void> {
    if (!input.recorded) {
      return;
    }

    const ownerId = await this.activityRepository.findDataRoomOwnerId(
      input.dataRoomId,
    );
    if (!ownerId || ownerId === input.actorUserId) {
      return;
    }

    const event: LiveEvent = {
      type: 'activity_recorded',
      dataRoomId: input.dataRoomId,
    };
    this.eventsBroker.publishToUser(ownerId, event);
  }
}
