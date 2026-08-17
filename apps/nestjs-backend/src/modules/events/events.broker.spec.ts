import type { LiveEvent } from '@sdr/shared/events';
import { EventsBroker } from './events.broker';
import { EVENTS_MAX_CONNECTIONS_PER_USER } from './events.constants';

const ROOM = '11111111-1111-4111-8111-111111111111';
const FOLDER = '22222222-2222-4222-8222-222222222222';

const revoked: LiveEvent = {
  type: 'access_invalidated',
  reason: 'revoked',
  dataRoomId: ROOM,
  target: { kind: 'folder', id: FOLDER },
};

const gone: LiveEvent = {
  type: 'resource_gone',
  reason: 'deleted',
  dataRoomId: ROOM,
  subject: { kind: 'folder', id: FOLDER },
};

describe('EventsBroker', () => {
  it('delivers a grant revoke only to that user', () => {
    const broker = new EventsBroker();
    const forViewer: LiveEvent[] = [];
    const forOwner: LiveEvent[] = [];

    broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      { next: (event) => forViewer.push(event), complete: () => undefined },
    );
    broker.subscribe(
      { userId: 'owner', publicLinkId: null, dataRoomId: ROOM },
      { next: (event) => forOwner.push(event), complete: () => undefined },
    );

    broker.publishToUser('viewer', revoked);

    expect(forViewer).toEqual([revoked]);
    expect(forOwner).toEqual([]);
  });

  it('does not deliver a grant revoke to a public-link stream', () => {
    const broker = new EventsBroker();
    const guest: LiveEvent[] = [];

    broker.subscribe(
      { userId: null, publicLinkId: 'link-1', dataRoomId: ROOM },
      { next: (event) => guest.push(event), complete: () => undefined },
    );

    broker.publishToUser('viewer', revoked);
    expect(guest).toEqual([]);

    broker.publishToPublicLink('link-1', revoked);
    expect(guest).toEqual([revoked]);
  });

  it('removes a slot on unsubscribe', () => {
    const broker = new EventsBroker();
    const received: LiveEvent[] = [];
    const sub = broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      { next: (event) => received.push(event), complete: () => undefined },
    );

    sub.unsubscribe();
    broker.publishToUser('viewer', revoked);

    expect(received).toEqual([]);
    expect(broker.size()).toBe(0);
  });

  it('evicts the oldest connection when the user hits the cap', () => {
    const broker = new EventsBroker();
    const completed: string[] = [];

    for (let index = 0; index < EVENTS_MAX_CONNECTIONS_PER_USER; index += 1) {
      const id = `slot-${index}`;
      broker.subscribe(
        { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
        {
          next: () => undefined,
          complete: () => completed.push(id),
        },
      );
    }

    broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      { next: () => undefined, complete: () => undefined },
    );

    expect(completed).toEqual(['slot-0']);
    expect(broker.size()).toBe(EVENTS_MAX_CONNECTIONS_PER_USER);
  });

  it('delivers resource_gone only to the matching data room', () => {
    const broker = new EventsBroker();
    const inRoom: LiveEvent[] = [];
    const other: LiveEvent[] = [];

    broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      { next: (event) => inRoom.push(event), complete: () => undefined },
    );
    broker.subscribe(
      {
        userId: 'stranger',
        publicLinkId: null,
        dataRoomId: '33333333-3333-4333-8333-333333333333',
      },
      { next: (event) => other.push(event), complete: () => undefined },
    );

    broker.publishToDataRoom(ROOM, gone);

    expect(inRoom).toEqual([gone]);
    expect(other).toEqual([]);
  });

  it('keeps delivering if one subscriber throws', () => {
    const broker = new EventsBroker();
    const received: LiveEvent[] = [];

    broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      {
        next: () => {
          throw new Error('dead tab');
        },
        complete: () => undefined,
      },
    );
    broker.subscribe(
      { userId: 'viewer', publicLinkId: null, dataRoomId: ROOM },
      { next: (event) => received.push(event), complete: () => undefined },
    );

    expect(() => broker.publishToUser('viewer', revoked)).not.toThrow();
    expect(received).toEqual([revoked]);
  });
});
