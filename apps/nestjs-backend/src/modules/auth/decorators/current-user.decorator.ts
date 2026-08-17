import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@sdr/shared/auth';
import type { Request } from 'express';

export type SessionUser = AuthUser & {
  sessionId: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: SessionUser }>();
    return request.user;
  },
);

export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    return request.user ?? null;
  },
);
