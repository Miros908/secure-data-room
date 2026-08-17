import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { NoStoreCacheInterceptor } from './no-store-cache.interceptor';

describe('NoStoreCacheInterceptor', () => {
  it('sets Cache-Control private, no-store', () => {
    const interceptor = new NoStoreCacheInterceptor();
    const setHeader = jest.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/files/abc' }),
        getResponse: () => ({ setHeader }),
      }),
    } as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    const result = interceptor.intercept(context, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    return new Promise<void>((resolve) => {
      result.subscribe((value) => {
        expect(value).toEqual({ ok: true });
        resolve();
      });
    });
  });

  it('sets SSE headers on GET /events', () => {
    const interceptor = new NoStoreCacheInterceptor();
    const setHeader = jest.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: '/events?token=abc' }),
        getResponse: () => ({ setHeader }),
      }),
    } as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    interceptor.intercept(context, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store, no-transform',
    );
    expect(setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
  });
});
