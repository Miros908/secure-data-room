import { liveEventSchema, type LiveEvent } from '@sdr/shared/events';

export const LIVE_PING_TIMEOUT_MS = 45_000;
export const LIVE_BACKOFF_CAP_MS = 30_000;

export type LiveEventsClock = {
  now: () => number;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  random: () => number;
};

export type ConnectLiveEventsOptions = {
  url: string;
  fetch?: typeof fetch;
  clock?: LiveEventsClock;
  pingTimeoutMs?: number;
  onEvent: (event: LiveEvent) => void;
  onGap: () => void;
  onAuthLost?: () => void;
  onLinkGone?: () => void;
};

export type LiveEventsSession = {
  close: () => void;
};

const defaultClock: LiveEventsClock = {
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }

      const timer = window.setTimeout(resolve, ms);
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(abortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }),
};

export function connectLiveEvents(
  options: ConnectLiveEventsOptions,
): LiveEventsSession {
  const fetchImpl = options.fetch ?? fetch.bind(globalThis);
  const clock = options.clock ?? defaultClock;
  const pingTimeoutMs = options.pingTimeoutMs ?? LIVE_PING_TIMEOUT_MS;
  const sessionAbort = new AbortController();
  let streamAbort = new AbortController();
  let attempt = 0;
  let reconnectNow = false;

  const bumpStream = () => {
    streamAbort.abort();
    streamAbort = new AbortController();
  };

  const onVisible = () => {
    if (document.visibilityState !== 'visible' || sessionAbort.signal.aborted) {
      return;
    }
    attempt = 0;
    reconnectNow = true;
    options.onGap();
    bumpStream();
  };

  const onOnline = () => {
    if (sessionAbort.signal.aborted) {
      return;
    }
    attempt = 0;
    reconnectNow = true;
    options.onGap();
    bumpStream();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  const run = async () => {
    while (!sessionAbort.signal.aborted) {
      reconnectNow = false;

      try {
        await readStream({
          url: options.url,
          fetchImpl,
          clock,
          pingTimeoutMs,
          sessionSignal: sessionAbort.signal,
          streamSignal: streamAbort.signal,
          onEvent: options.onEvent,
          onOpen: () => {
            attempt = 0;
            options.onGap();
          },
        });
      } catch (error) {
        if (sessionAbort.signal.aborted) {
          return;
        }

        if (isAuthLost(error)) {
          options.onAuthLost?.();
          return;
        }

        if (isLinkGone(error)) {
          options.onLinkGone?.();
          return;
        }

        if (!isAbortError(error) || !reconnectNow) {
          options.onGap();
        }
      }

      if (sessionAbort.signal.aborted) {
        return;
      }

      if (reconnectNow) {
        continue;
      }

      const delay = backoffMs(attempt, clock.random());
      attempt += 1;
      try {
        await clock.sleep(delay, sessionAbort.signal);
      } catch {
        return;
      }
    }
  };

  void run();

  return {
    close: () => {
      sessionAbort.abort();
      streamAbort.abort();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    },
  };
}

async function readStream(input: {
  url: string;
  fetchImpl: typeof fetch;
  clock: LiveEventsClock;
  pingTimeoutMs: number;
  sessionSignal: AbortSignal;
  streamSignal: AbortSignal;
  onEvent: (event: LiveEvent) => void;
  onOpen: () => void;
}): Promise<void> {
  const signal = input.streamSignal;
  const response = await input.fetchImpl(input.url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'text/event-stream' },
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('unauthorized'), { status: response.status });
  }

  if (response.status === 404) {
    throw Object.assign(new Error('not_found'), { status: 404 });
  }

  if (!response.ok || !response.body) {
    throw new Error(`live_events_${response.status}`);
  }

  input.onOpen();
  let lastActivity = input.clock.now();
  let buffer = '';
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  const watchAbort = new AbortController();

  const onParentAbort = () => watchAbort.abort();
  signal.addEventListener('abort', onParentAbort, { once: true });
  input.sessionSignal.addEventListener('abort', onParentAbort, { once: true });

  void (async () => {
    try {
      while (!watchAbort.signal.aborted) {
        await input.clock.sleep(5_000, watchAbort.signal);
        if (input.clock.now() - lastActivity > input.pingTimeoutMs) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
    } catch {
      return;
    }
  })();

  try {
    while (!signal.aborted) {
      const next = await reader.read();
      if (next.done) {
        return;
      }

      lastActivity = input.clock.now();
      buffer += decoder
        .decode(next.value, { stream: true })
        .replace(/\r\n/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        dispatchSseBlock(block, input.onEvent);
      }
    }
  } finally {
    watchAbort.abort();
    signal.removeEventListener('abort', onParentAbort);
    input.sessionSignal.removeEventListener('abort', onParentAbort);
    try {
      reader.releaseLock();
    } catch {
      return;
    }
  }
}

export function dispatchSseBlock(
  block: string,
  onEvent: (event: LiveEvent) => void,
): void {
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (eventName === 'ping' || dataLines.length === 0) {
    return;
  }

  try {
    const parsed = liveEventSchema.safeParse(JSON.parse(dataLines.join('\n')));
    if (parsed.success) {
      onEvent(parsed.data);
    }
  } catch {
    return;
  }
}

export function backoffMs(attempt: number, random: number): number {
  const base = Math.min(LIVE_BACKOFF_CAP_MS, 1_000 * 2 ** Math.min(attempt, 5));
  return Math.round(base * (0.8 + random * 0.4));
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isAuthLost(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    ((error as { status: number }).status === 401 ||
      (error as { status: number }).status === 403)
  );
}

function isLinkGone(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: number }).status === 404
  );
}
