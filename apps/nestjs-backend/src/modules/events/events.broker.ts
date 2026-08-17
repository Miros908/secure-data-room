import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { LiveEvent } from '@sdr/shared/events';
import {
  EVENTS_MAX_CONNECTIONS_PER_PUBLIC_LINK,
  EVENTS_MAX_CONNECTIONS_PER_USER,
} from './events.constants';
import type { EventsAudience, EventsSlotHandler } from './events.types';

type Slot = EventsAudience &
  EventsSlotHandler & {
    id: string;
    createdAt: number;
  };

export type EventsSubscription = {
  unsubscribe: () => void;
};

@Injectable()
export class EventsBroker {
  private readonly slots = new Map<string, Slot>();

  subscribe(
    audience: EventsAudience,
    handler: EventsSlotHandler,
  ): EventsSubscription {
    this.evictIfNeeded(audience);

    const id = randomUUID();
    const slot: Slot = {
      id,
      createdAt: Date.now(),
      ...audience,
      next: handler.next,
      complete: handler.complete,
    };
    this.slots.set(id, slot);

    return {
      unsubscribe: () => {
        this.drop(id, false);
      },
    };
  }

  publishToUser(userId: string, event: LiveEvent): void {
    this.emitWhere((slot) => slot.userId === userId, event);
  }

  publishToPublicLink(publicLinkId: string, event: LiveEvent): void {
    this.emitWhere((slot) => slot.publicLinkId === publicLinkId, event);
  }

  publishToDataRoom(dataRoomId: string, event: LiveEvent): void {
    this.emitWhere((slot) => slot.dataRoomId === dataRoomId, event);
  }

  size(): number {
    return this.slots.size;
  }

  private emitWhere(match: (slot: Slot) => boolean, event: LiveEvent): void {
    for (const slot of [...this.slots.values()]) {
      if (!match(slot)) {
        continue;
      }

      try {
        slot.next(event);
      } catch {
        this.drop(slot.id, true);
      }
    }
  }

  private evictIfNeeded(audience: EventsAudience): void {
    if (audience.userId) {
      this.evict(
        [...this.slots.values()].filter(
          (slot) => slot.userId === audience.userId,
        ),
        EVENTS_MAX_CONNECTIONS_PER_USER,
      );
      return;
    }

    if (audience.publicLinkId) {
      this.evict(
        [...this.slots.values()].filter(
          (slot) => slot.publicLinkId === audience.publicLinkId && !slot.userId,
        ),
        EVENTS_MAX_CONNECTIONS_PER_PUBLIC_LINK,
      );
    }
  }

  private evict(matches: Slot[], max: number): void {
    if (matches.length < max) {
      return;
    }

    const oldest = [...matches].sort((a, b) => a.createdAt - b.createdAt)[0];
    this.drop(oldest.id, true);
  }

  private drop(id: string, complete: boolean): void {
    const slot = this.slots.get(id);
    if (!slot) {
      return;
    }

    this.slots.delete(id);
    if (complete) {
      try {
        slot.complete();
      } catch {
        return;
      }
    }
  }
}
