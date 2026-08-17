import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class PublicAbuseGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (await super.shouldSkip(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
      query?: { token?: unknown };
    }>();
    const url = String(request.originalUrl ?? request.url ?? '');

    if (url.includes('/access/public-links/resolve')) {
      return false;
    }

    return (
      typeof request.query?.token !== 'string' ||
      request.query.token.length === 0
    );
  }
}
