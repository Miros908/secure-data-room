import type {
  ClientRequest,
  IncomingHttpHeaders,
  IncomingMessage,
} from 'node:http';
import { request as httpRequest } from 'node:http';

export type SseFrame = {
  event: string;
  data: unknown;
  id?: string;
};

export class SseClient {
  readonly frames: SseFrame[] = [];
  readonly headers: IncomingHttpHeaders;
  private buffer = '';
  private readonly waiters: Array<(frame: SseFrame) => void> = [];
  private readonly req: ClientRequest;
  private readonly response: IncomingMessage;

  private constructor(req: ClientRequest, response: IncomingMessage) {
    this.req = req;
    this.response = response;
    this.headers = response.headers;
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => this.push(chunk));
  }

  static open(input: {
    port: number;
    cookie?: string;
    token?: string;
    dataRoomId?: string;
  }): Promise<SseClient> {
    const query = new URLSearchParams();
    if (input.token) {
      query.set('token', input.token);
    }
    if (input.dataRoomId) {
      query.set('dataRoomId', input.dataRoomId);
    }
    const search = query.toString();
    const path = search ? `/events?${search}` : '/events';
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (input.cookie) {
      headers.Cookie = input.cookie;
    }

    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: '127.0.0.1',
          port: input.port,
          path,
          method: 'GET',
          headers,
        },
        (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(
              Object.assign(new Error(`sse ${response.statusCode}`), {
                statusCode: response.statusCode,
              }),
            );
            response.resume();
            req.destroy();
            return;
          }

          resolve(new SseClient(req, response));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  waitFor(event: string, timeoutMs = 5_000): Promise<SseFrame> {
    const existing = this.frames.find((frame) => frame.event === event);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timed out waiting for SSE ${event}`));
      }, timeoutMs);

      this.waiters.push((frame) => {
        if (frame.event === event) {
          clearTimeout(timer);
          resolve(frame);
        }
      });
    });
  }

  close(): void {
    this.req.destroy();
    this.response.destroy();
  }

  private push(chunk: string): void {
    this.buffer += chunk.replace(/\r\n/g, '\n');
    const blocks = this.buffer.split('\n\n');
    this.buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const frame = parseSseBlock(block);
      if (!frame) {
        continue;
      }
      this.frames.push(frame);
      for (const waiter of this.waiters) {
        waiter(frame);
      }
    }
  }
}

export function parseSseBlock(block: string): SseFrame | null {
  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('id:')) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const raw = dataLines.join('\n');
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return { event, data, id };
}
