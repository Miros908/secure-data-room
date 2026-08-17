import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ActivityLivePublisher } from './activity-live.publisher';
import { ActivityRepository } from './activity.repository';

@Module({
  imports: [EventsModule],
  providers: [ActivityRepository, ActivityLivePublisher],
  exports: [ActivityRepository, ActivityLivePublisher],
})
export class ActivityCoreModule {}
