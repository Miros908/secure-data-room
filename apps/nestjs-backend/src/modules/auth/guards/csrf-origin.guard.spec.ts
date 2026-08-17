import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { CsrfOriginGuard } from './csrf-origin.guard';

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('CsrfOriginGuard', () => {
  const guard = new CsrfOriginGuard();
  const previous = process.env.CORS_ORIGIN;

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env.CORS_ORIGIN = previous;
  });

  it('allows GET from any origin', () => {
    expect(
      guard.canActivate(
        httpContext({
          method: 'GET',
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toBe(true);
  });

  it('allows a mutating request from the allowlisted origin', () => {
    expect(
      guard.canActivate(
        httpContext({
          method: 'POST',
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).toBe(true);
  });

  it('allows a mutating request without Origin', () => {
    expect(
      guard.canActivate(
        httpContext({
          method: 'DELETE',
          headers: {},
        }),
      ),
    ).toBe(true);
  });

  it('rejects a mutating request from a foreign origin', () => {
    expect(() =>
      guard.canActivate(
        httpContext({
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
