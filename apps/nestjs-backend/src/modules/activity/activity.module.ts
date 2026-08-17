import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivityController } from './activity.controller';
import { ActivityCoreModule } from './activity-core.module';
import { GetActivitySummaryService } from './services/get-activity-summary.service';
import { GetActivityTimelineService } from './services/get-activity-timeline.service';
import { RecordFileDownloadService } from './services/record-file-download.service';
import { RecordFileViewService } from './services/record-file-view.service';

@Module({
  imports: [AccessModule, ActivityCoreModule],
  controllers: [ActivityController],
  providers: [
    RecordFileViewService,
    RecordFileDownloadService,
    GetActivitySummaryService,
    GetActivityTimelineService,
  ],
})
export class ActivityModule {}
