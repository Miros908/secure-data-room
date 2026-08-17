import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { hashShareToken } from '../../access/utils/share-token';
import type { SessionUser } from '../../auth/decorators/current-user.decorator';
import { EventsRepository } from '../events.repository';

type HandshakeRequest = Request & { user?: SessionUser };

@Injectable()
export class EventsHandshakeGuard implements CanActivate {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HandshakeRequest>();
    const token = queryString(request.query?.token);

    if (token) {
      const link = await this.eventsRepository.findActivePublicLinkByTokenHash(
        hashShareToken(token),
      );

      if (!link) {
        throw new NotFoundException('not_found');
      }

      return true;
    }

    if (!request.user) {
      throw new UnauthorizedException('unauthorized');
    }

    return true;
  }
}

function queryString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return undefined;
}
