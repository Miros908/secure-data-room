import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export type RequestWithId = Request & { requestId: string };

const requestIdStore = new AsyncLocalStorage<string>();

const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

export function currentRequestId(): string {
  return requestIdStore.getStore() ?? randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();

  (req as RequestWithId).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  requestIdStore.run(requestId, () => next());
}
