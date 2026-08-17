import {
  decodeTimelineCursor,
  encodeTimelineCursor,
  linkActorKey,
  parseActorKey,
  userActorKey,
} from './activity.constants';

describe('activity.constants', () => {
  it('round-trips actor keys', () => {
    expect(parseActorKey(userActorKey('user-1'))).toEqual({
      kind: 'user',
      userId: 'user-1',
    });
    expect(parseActorKey(linkActorKey('link-1'))).toEqual({
      kind: 'link',
      linkId: 'link-1',
    });
    expect(parseActorKey('user:')).toBeNull();
    expect(parseActorKey('guest:1')).toBeNull();
  });

  it('round-trips a timeline cursor', () => {
    const createdAt = new Date('2026-08-16T12:00:00.000Z');
    const cursor = encodeTimelineCursor(createdAt, 'event-1');

    expect(decodeTimelineCursor(cursor)).toEqual({ createdAt, id: 'event-1' });
    expect(decodeTimelineCursor('not-a-cursor')).toBeNull();
  });
});
