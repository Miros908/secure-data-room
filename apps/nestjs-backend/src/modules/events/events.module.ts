import { Module } from '@nestjs/common';
import { EventsBroker } from './events.broker';
import { EventsController } from './events.controller';
import { EventsHandshakeGuard } from './guards/events-handshake.guard';
import { EventsRepository } from './events.repository';
import { StreamEventsService } from './services/stream-events.service';

@Module({
  controllers: [EventsController],
  providers: [
    EventsBroker,
    EventsRepository,
    EventsHandshakeGuard,
    StreamEventsService,
  ],
  exports: [EventsBroker],
})
export class EventsModule {}
