import {
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { hashSessionToken } from '../utils/session-token';
import { SessionGuard } from './session.guard';
import type { AuthRepository } from '../auth.repository';

const RAW_TOKEN = 'ab'.repeat(32);

function httpContext(request: object): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('SessionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const authRepository = {
    findActiveByTokenHash: jest.fn(),
  };
  const guard = new SessionGuard(
    reflector as unknown as Reflector,
    authRepository as unknown as AuthRepository,
  );

  const activeSession = {
    id: 'session-1',
    user: {
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
      status: 'ACTIVE' as const,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows a public route without a cookie and does not attach a user', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const request: { cookies?: Record<string, string>; user?: unknown } = {};

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(authRepository.findActiveByTokenHash).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('attaches the user on a public route when the session is valid', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    authRepository.findActiveByTokenHash.mockResolvedValue(activeSession);
    const request: { cookies?: Record<string, string>; user?: unknown } = {
      cookies: { [SESSION_COOKIE_NAME]: RAW_TOKEN },
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(authRepository.findActiveByTokenHash).toHaveBeenCalledWith(
      hashSessionToken(RAW_TOKEN),
    );
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
      sessionId: 'session-1',
    });
  });

  it('ignores a missing session on a public route', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    authRepository.findActiveByTokenHash.mockResolvedValue(null);
    const request: { cookies?: Record<string, string>; user?: unknown } = {
      cookies: { [SESSION_COOKIE_NAME]: RAW_TOKEN },
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('rejects a suspended user even on a public route', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    authRepository.findActiveByTokenHash.mockResolvedValue({
      ...activeSession,
      user: { ...activeSession.user, status: 'SUSPENDED' },
    });
    const request = {
      cookies: { [SESSION_COOKIE_NAME]: RAW_TOKEN },
    };

    await expect(
      guard.canActivate(httpContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 401 on a private route without a cookie', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(httpContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns 401 when the session is missing, revoked, or expired', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authRepository.findActiveByTokenHash.mockResolvedValue(null);
    const request = {
      cookies: { [SESSION_COOKIE_NAME]: RAW_TOKEN },
    };

    await expect(
      guard.canActivate(httpContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 when the session user is suspended', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authRepository.findActiveByTokenHash.mockResolvedValue({
      ...activeSession,
      user: { ...activeSession.user, status: 'SUSPENDED' },
    });
    const request = {
      cookies: { [SESSION_COOKIE_NAME]: RAW_TOKEN },
    };

    await expect(
      guard.canActivate(httpContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
