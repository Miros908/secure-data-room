import { describe, expect, it } from 'vitest';
import { liveEventsUrl } from '@/app/lib/live-events-url';

const ROOM = '11111111-1111-4111-8111-111111111111';

describe('liveEventsUrl', () => {
  it('builds a session stream URL with the current room', () => {
    const url = new URL(liveEventsUrl({ dataRoomId: ROOM }));
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('dataRoomId')).toBe(ROOM);
    expect(url.searchParams.get('token')).toBeNull();
  });

  it('puts the public token in the query like the rest of /share', () => {
    const url = new URL(liveEventsUrl({ token: 'abc', dataRoomId: ROOM }));
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('token')).toBe('abc');
    expect(url.searchParams.get('dataRoomId')).toBe(ROOM);
  });
});
