import type { ExecutionContext } from '@nestjs/common';
import { PublicAbuseGuard } from './public-abuse.guard';

class TestablePublicAbuseGuard extends PublicAbuseGuard {
  constructor() {
    super(
      { throttlers: [] },
      {} as never,
      { getAllAndOverride: () => undefined } as never,
    );
  }

  exposeShouldSkip(context: ExecutionContext) {
    return this.shouldSkip(context);
  }
}

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('PublicAbuseGuard', () => {
  const guard = new TestablePublicAbuseGuard();

  it('never skips public-link resolve', async () => {
    await expect(
      guard.exposeShouldSkip(
        httpContext({
          originalUrl: '/access/public-links/resolve?token=',
          query: {},
        }),
      ),
    ).resolves.toBe(false);
  });

  it('does not skip when a share token is present', async () => {
    await expect(
      guard.exposeShouldSkip(
        httpContext({
          url: '/files/file-1',
          query: { token: 'ab'.repeat(32) },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('skips authenticated listing without a token', async () => {
    await expect(
      guard.exposeShouldSkip(
        httpContext({
          url: '/folders/folder-1',
          query: {},
        }),
      ),
    ).resolves.toBe(true);
  });

  it('skips an empty token string', async () => {
    await expect(
      guard.exposeShouldSkip(
        httpContext({
          url: '/files/file-1',
          query: { token: '' },
        }),
      ),
    ).resolves.toBe(true);
  });
});
