import { liveEventSchema } from '@sdr/shared/events';

const ROOM = '11111111-1111-4111-8111-111111111111';
const FILE = '22222222-2222-4222-8222-222222222222';

describe('liveEventSchema', () => {
  it('keeps a known event when extra fields are present', () => {
    const parsed = liveEventSchema.safeParse({
      type: 'access_invalidated',
      reason: 'revoked',
      dataRoomId: ROOM,
      target: { kind: 'file', id: FILE },
      extra: 'ignored',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe('access_invalidated');
    }
  });

  it('rejects an unknown type', () => {
    const parsed = liveEventSchema.safeParse({
      type: 'presence',
      dataRoomId: ROOM,
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts activity_recorded', () => {
    const parsed = liveEventSchema.safeParse({
      type: 'activity_recorded',
      dataRoomId: ROOM,
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts access_granted', () => {
    const parsed = liveEventSchema.safeParse({
      type: 'access_granted',
      dataRoomId: ROOM,
      target: { kind: 'file', id: FILE },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe('access_granted');
    }
  });
});
