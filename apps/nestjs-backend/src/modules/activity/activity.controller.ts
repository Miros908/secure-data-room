import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  activityTimelineQuerySchema,
  recordFileActivityQuerySchema,
  type ActivityTimelineQuery,
  type RecordFileActivityQuery,
} from '@sdr/shared/activity';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  CurrentUser,
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { GetActivitySummaryService } from './services/get-activity-summary.service';
import { GetActivityTimelineService } from './services/get-activity-timeline.service';
import { RecordFileDownloadService } from './services/record-file-download.service';
import { RecordFileViewService } from './services/record-file-view.service';

@Controller()
export class ActivityController {
  constructor(
    private readonly recordFileViewService: RecordFileViewService,
    private readonly recordFileDownloadService: RecordFileDownloadService,
    private readonly getActivitySummaryService: GetActivitySummaryService,
    private readonly getActivityTimelineService: GetActivityTimelineService,
  ) {}

  @Public()
  @Post('files/:id/view')
  @HttpCode(200)
  recordView(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(recordFileActivityQuerySchema))
    query: RecordFileActivityQuery,
  ) {
    return this.recordFileViewService.execute({
      id,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Public()
  @Post('files/:id/download')
  @HttpCode(200)
  recordDownload(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(recordFileActivityQuerySchema))
    query: RecordFileActivityQuery,
  ) {
    return this.recordFileDownloadService.execute({
      id,
      userId: user?.id ?? null,
      token: query.token,
      versionId: query.versionId,
    });
  }

  @Get('data-rooms/:id/activity/summary')
  summary(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.getActivitySummaryService.execute({
      dataRoomId: id,
      userId: user.id,
    });
  }

  @Get('data-rooms/:id/activity')
  timeline(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(new ZodValidationPipe(activityTimelineQuerySchema))
    query: ActivityTimelineQuery,
  ) {
    return this.getActivityTimelineService.execute({
      ...query,
      dataRoomId: id,
      userId: user.id,
    });
  }
}
