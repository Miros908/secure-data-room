import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backoffMs,
  connectLiveEvents,
  dispatchSseBlock,
} from '@/app/lib/connect-live-events';
import type { LiveEvent } from '@sdr/shared/events';

const ROOM = '11111111-1111-4111-8111-111111111111';
const FILE = '22222222-2222-4222-8222-222222222222';

const revoked: LiveEvent = {
  type: 'access_invalidated',
  reason: 'revoked',
  dataRoomId: ROOM,
  target: { kind: 'file', id: FILE },
};

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
        return;
      }
    },
  });
}

describe('dispatchSseBlock', () => {
  it('parses a live event and ignores junk', () => {
    const events: LiveEvent[] = [];
    dispatchSseBlock(
      `event: access_invalidated\ndata: ${JSON.stringify(revoked)}`,
      (event) => events.push(event),
    );
    dispatchSseBlock('event: access_invalidated\ndata: {not json', (event) =>
      events.push(event),
    );
    dispatchSseBlock(
      'event: presence\ndata: {"type":"presence"}',
      (event) => events.push(event),
    );

    expect(events).toEqual([revoked]);
  });
});

describe('backoffMs', () => {
  it('caps at 30s with jitter around the base', () => {
    expect(backoffMs(0, 0.5)).toBe(1000);
    expect(backoffMs(5, 0.5)).toBe(30_000);
  });
});

describe('connectLiveEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stops on 401 and does not backoff', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      body: null,
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onAuthLost = vi.fn();
    const onGap = vi.fn();

    const session = connectLiveEvents({
      url: 'http://localhost:4000/events',
      fetch: fetchImpl as unknown as typeof fetch,
      clock: { now: () => 0, sleep, random: () => 0.5 },
      onEvent: vi.fn(),
      onGap,
      onAuthLost,
    });

    await vi.waitFor(() => {
      expect(onAuthLost).toHaveBeenCalled();
    });
    expect(sleep).not.toHaveBeenCalled();
    session.close();
  });

  it('emits a parsed event and refetches on open', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        `event: access_invalidated\ndata: ${JSON.stringify(revoked)}\n\n`,
      ]),
    });
    const onEvent = vi.fn();
    const onGap = vi.fn();
    const sleep = vi.fn(
      (_ms: number, signal: AbortSignal) =>
        new Promise<void>((resolve, reject) => {
          const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        }),
    );

    const session = connectLiveEvents({
      url: 'http://localhost:4000/events',
      fetch: fetchImpl as unknown as typeof fetch,
      clock: { now: () => 0, sleep, random: () => 0.5 },
      pingTimeoutMs: 60_000,
      onEvent,
      onGap,
    });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(revoked);
    });
    expect(onGap).toHaveBeenCalled();
    session.close();
  });

  it('closes the fetch when unmounted', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const session = connectLiveEvents({
      url: 'http://localhost:4000/events',
      fetch: fetchImpl as unknown as typeof fetch,
      clock: {
        now: () => 0,
        sleep: () => new Promise(() => undefined),
        random: () => 0.5,
      },
      onEvent: vi.fn(),
      onGap: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalled();
    });
    session.close();
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('stops on a dead public link and does not backoff', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onLinkGone = vi.fn();

    const session = connectLiveEvents({
      url: 'http://localhost:4000/events?token=dead',
      fetch: fetchImpl as unknown as typeof fetch,
      clock: { now: () => 0, sleep, random: () => 0.5 },
      onEvent: vi.fn(),
      onGap: vi.fn(),
      onLinkGone,
    });

    await vi.waitFor(() => {
      expect(onLinkGone).toHaveBeenCalled();
    });
    expect(sleep).not.toHaveBeenCalled();
    session.close();
  });
});
