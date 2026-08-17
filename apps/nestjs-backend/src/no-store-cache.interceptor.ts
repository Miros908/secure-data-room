import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

@Injectable()
export class NoStoreCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = String(request.originalUrl ?? request.url ?? '').split('?')[0];

    if (path === '/events') {
      response.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      return next.handle();
    }

    response.setHeader('Cache-Control', 'private, no-store');
    return next.handle();
  }
}
