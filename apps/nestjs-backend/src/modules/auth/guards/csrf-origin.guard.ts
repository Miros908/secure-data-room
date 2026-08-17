import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { isAllowedMutatingOrigin, parseCorsOrigin } from '../../../cors-origin';

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    const originValue = typeof origin === 'string' ? origin : undefined;
    const allowed = parseCorsOrigin(process.env.CORS_ORIGIN);

    if (!isAllowedMutatingOrigin(request.method, originValue, allowed)) {
      throw new ForbiddenException('forbidden');
    }

    return true;
  }
}
