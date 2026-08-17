import { Controller, Query, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  streamEventsQuerySchema,
  type StreamEventsQuery,
} from '@sdr/shared/events';
import type { Observable } from 'rxjs';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import {
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { EventsHandshakeGuard } from './guards/events-handshake.guard';
import { StreamEventsService } from './services/stream-events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly streamEventsService: StreamEventsService) {}

  @Public()
  @UseGuards(EventsHandshakeGuard)
  @Sse()
  stream(
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(streamEventsQuerySchema))
    query: StreamEventsQuery,
  ): Promise<Observable<MessageEvent>> {
    return this.streamEventsService.execute({
      user,
      token: query.token,
      dataRoomId: query.dataRoomId,
    });
  }
}
