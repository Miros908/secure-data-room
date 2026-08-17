import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { AuthRepository } from '../auth.repository';
import type { SessionUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { hashSessionToken } from '../utils/session-token';

type AuthedRequest = Request & { user?: SessionUser };

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authRepository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    if (isPublic) {
      await this.attachUser(request, false);
      return true;
    }

    await this.attachUser(request, true);
    return true;
  }

  private async attachUser(
    request: AuthedRequest,
    required: boolean,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string> | undefined;
    const rawToken = cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken) {
      if (required) {
        throw new UnauthorizedException('unauthorized');
      }

      return;
    }

    const session = await this.authRepository.findActiveByTokenHash(
      hashSessionToken(rawToken),
    );

    if (!session) {
      this.logger.debug('Session missing, revoked, or expired');

      if (required) {
        throw new UnauthorizedException('unauthorized');
      }

      return;
    }

    if (session.user.status === 'SUSPENDED') {
      throw new ForbiddenException('forbidden');
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
    };
  }
}
