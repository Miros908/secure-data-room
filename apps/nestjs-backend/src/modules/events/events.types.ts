import type { LiveEvent } from '@sdr/shared/events';

export type EventsAudience = {
  userId: string | null;
  publicLinkId: string | null;
  dataRoomId: string | null;
};

export type EventsSlotHandler = {
  next: (event: LiveEvent) => void;
  complete: () => void;
};
