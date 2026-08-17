import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthRepository } from '../auth.repository';
import type { SessionUser } from '../decorators/current-user.decorator';
import {
  parseUploadTicket,
  signaturesMatch,
  signUploadTicket,
  UPLOAD_TICKET_HEADER,
} from '../utils/upload-ticket';

type AuthedRequest = Request & { user?: SessionUser };

@Injectable()
export class UploadAuthGuard implements CanActivate {
  constructor(private readonly authRepository: AuthRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (request.user) {
      return true;
    }

    const ticket = headerValue(request.headers[UPLOAD_TICKET_HEADER]);
    const parsed = ticket ? parseUploadTicket(ticket) : null;
    if (!parsed || parsed.expiresAtMs <= Date.now()) {
      throw new UnauthorizedException('unauthorized');
    }

    const session = await this.authRepository.findActiveById(parsed.sessionId);
    if (!session) {
      throw new UnauthorizedException('unauthorized');
    }

    const expected = signUploadTicket(
      session.id,
      parsed.expiresAtMs,
      session.tokenHash,
    );
    if (!signaturesMatch(parsed.signature, expected)) {
      throw new UnauthorizedException('unauthorized');
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
    return true;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
