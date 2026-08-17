import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import type { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

function run(incoming?: string) {
  const req = {
    headers: incoming ? { [REQUEST_ID_HEADER]: incoming } : {},
  } as unknown as Request;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  const next = jest.fn() as NextFunction;

  requestIdMiddleware(req, res, next);

  return {
    requestId: (req as Request & { requestId: string }).requestId,
    setHeader,
    next,
  };
}

describe('requestIdMiddleware', () => {
  it('accepts a safe incoming id', () => {
    const { requestId, setHeader, next } = run('req-abc_1');

    expect(requestId).toBe('req-abc_1');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-abc_1');
    expect(next).toHaveBeenCalled();
  });

  it('replaces an unsafe incoming id', () => {
    const { requestId, setHeader } = run('../etc/passwd script');

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
  });

  it('generates an id when the header is missing', () => {
    const { requestId } = run();

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects an id longer than 64 characters', () => {
    const { requestId } = run('a'.repeat(65));

    expect(requestId).not.toBe('a'.repeat(65));
  });
});
