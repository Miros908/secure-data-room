import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { StreamEventsQuery } from '@sdr/shared/events';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { hashShareToken } from '../../access/utils/share-token';
import type { SessionUser } from '../../auth/decorators/current-user.decorator';
import { EventsBroker } from '../events.broker';
import { EVENTS_PING_INTERVAL_MS } from '../events.constants';
import { EventsRepository } from '../events.repository';

export type StreamEventsInput = StreamEventsQuery & {
  user: SessionUser | null;
};

@Injectable()
export class StreamEventsService {
  constructor(
    private readonly eventsBroker: EventsBroker,
    private readonly eventsRepository: EventsRepository,
  ) {}

  async execute(input: StreamEventsInput): Promise<Observable<MessageEvent>> {
    const audience = await this.resolveAudience(input);

    return new Observable<MessageEvent>((subscriber) => {
      const ping = () => {
        subscriber.next({
          type: 'ping',
          data: {},
        });
      };

      const subscription = this.eventsBroker.subscribe(audience, {
        next: (event) => {
          subscriber.next({
            id: randomUUID(),
            type: event.type,
            data: event,
          });
        },
        complete: () => subscriber.complete(),
      });

      ping();
      const timer = setInterval(ping, EVENTS_PING_INTERVAL_MS);

      return () => {
        clearInterval(timer);
        subscription.unsubscribe();
      };
    });
  }

  private async resolveAudience(input: StreamEventsInput) {
    if (input.token) {
      const link = await this.eventsRepository.findActivePublicLinkByTokenHash(
        hashShareToken(input.token),
      );

      if (!link) {
        throw new NotFoundException('not_found');
      }

      return {
        userId: input.user?.id ?? null,
        publicLinkId: link.id,
        dataRoomId: link.dataRoomId,
      };
    }

    if (!input.user) {
      throw new UnauthorizedException('unauthorized');
    }

    const dataRoomId = input.dataRoomId
      ? await this.eventsRepository.findAccessibleDataRoomId(
          input.user.id,
          input.dataRoomId,
        )
      : null;

    return {
      userId: input.user.id,
      publicLinkId: null,
      dataRoomId,
    };
  }
}
