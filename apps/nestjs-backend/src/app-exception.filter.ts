import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  apiErrorCode,
  validationIssueSchema,
  type ApiError,
  type ValidationIssue,
} from '@sdr/shared/http';
import type { Response } from 'express';
import { z } from 'zod';
import { Prisma } from './database/generated/prisma/client';
import { redactRequestUrl } from './redact-request-url';
import type { RequestWithId } from './request-id.middleware';

const STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: apiErrorCode.badRequest,
  [HttpStatus.UNAUTHORIZED]: apiErrorCode.unauthorized,
  [HttpStatus.FORBIDDEN]: apiErrorCode.forbidden,
  [HttpStatus.NOT_FOUND]: apiErrorCode.notFound,
  [HttpStatus.CONFLICT]: apiErrorCode.conflict,
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'file_too_large',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'invalid_file_type',
  [HttpStatus.TOO_MANY_REQUESTS]: apiErrorCode.tooManyRequests,
};

const PRISMA_TO_ERROR: Record<string, Omit<ApiError, 'requestId'>> = {
  P2002: {
    statusCode: HttpStatus.CONFLICT,
    code: apiErrorCode.uniqueViolation,
  },
  P2003: {
    statusCode: HttpStatus.NOT_FOUND,
    code: apiErrorCode.notFound,
  },
  P2025: {
    statusCode: HttpStatus.NOT_FOUND,
    code: apiErrorCode.notFound,
  },
};

const SERVICE_CODE = /^[a-z][a-z0-9_]*$/;

const SERVER_ERROR_STATUS = 500;

const issuesSchema = z.array(validationIssueSchema);

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const body = this.toApiError(exception, request.requestId);
    const summary = `${request.method} ${redactRequestUrl(request.originalUrl)} -> ${body.statusCode} ${body.code} [${body.requestId}]`;

    if (body.statusCode >= SERVER_ERROR_STATUS) {
      this.logger.error(
        summary,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(summary);
    }

    response.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown, requestId: string): ApiError {
    if (exception instanceof HttpException) {
      return { ...this.fromHttpException(exception), requestId };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known = PRISMA_TO_ERROR[exception.code];
      if (known) {
        return { ...known, requestId };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: apiErrorCode.internalError,
      requestId,
    };
  }

  private fromHttpException(
    exception: HttpException,
  ): Omit<ApiError, 'requestId'> {
    const statusCode = exception.getStatus();
    const fallbackCode =
      STATUS_TO_CODE[statusCode] ??
      (statusCode >= SERVER_ERROR_STATUS
        ? apiErrorCode.internalError
        : apiErrorCode.badRequest);

    const payload = exception.getResponse();
    if (typeof payload !== 'object' || payload === null) {
      return { statusCode, code: fallbackCode };
    }

    const { message, issues } = payload as {
      message?: unknown;
      issues?: unknown;
    };
    const code =
      typeof message === 'string' && SERVICE_CODE.test(message)
        ? message
        : fallbackCode;
    const parsedIssues = this.toIssues(issues);

    return parsedIssues
      ? { statusCode, code, issues: parsedIssues }
      : { statusCode, code };
  }

  private toIssues(value: unknown): ValidationIssue[] | undefined {
    const result = issuesSchema.safeParse(value);
    return result.success ? result.data : undefined;
  }
}
