import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { apiErrorCode } from '@sdr/shared/http';
import { Prisma } from './database/generated/prisma/client';
import { AppExceptionFilter } from './app-exception.filter';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db', {
    code,
    clientVersion: 'test',
  });
}

function hostWith(url = '/files/1?token=secret-token') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const request = {
    method: 'GET',
    originalUrl: url,
    requestId: 'req-1',
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as ArgumentsHost;

  return { host, status, json };
}

describe('AppExceptionFilter', () => {
  const filter = new AppExceptionFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a service snake_case code', () => {
    const { host, status, json } = hostWith();

    filter.catch(new ConflictException('name_taken'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      code: 'name_taken',
      requestId: 'req-1',
    });
  });

  it('does not leak Nest framework text into code', () => {
    const { host, json } = hostWith();

    filter.catch(
      new HttpException('Cannot GET /x', HttpStatus.NOT_FOUND),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: apiErrorCode.notFound,
      requestId: 'req-1',
    });
  });

  it('attaches validation issues and drops garbage issues', () => {
    const { host, json } = hostWith();
    const issues = [{ path: 'email', message: 'required' }];

    filter.catch(
      new BadRequestException({ message: 'validation_error', issues }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'validation_error',
      issues,
      requestId: 'req-1',
    });

    const second = hostWith();
    filter.catch(
      new BadRequestException({
        message: 'validation_error',
        issues: 'nope',
      }),
      second.host,
    );
    expect(second.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'validation_error',
      requestId: 'req-1',
    });
  });

  it('maps Prisma unique and missing-row codes', () => {
    const unique = hostWith();
    filter.catch(prismaError('P2002'), unique.host);
    expect(unique.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      code: apiErrorCode.uniqueViolation,
      requestId: 'req-1',
    });

    const missing = hostWith();
    filter.catch(prismaError('P2025'), missing.host);
    expect(missing.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: apiErrorCode.notFound,
      requestId: 'req-1',
    });

    const fk = hostWith();
    filter.catch(prismaError('P2003'), fk.host);
    expect(fk.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: apiErrorCode.notFound,
      requestId: 'req-1',
    });
  });

  it('maps payload too large and unauthorized fallbacks', () => {
    const large = hostWith();
    filter.catch(new PayloadTooLargeException(), large.host);
    expect(large.json.mock.calls[0][0].code).toBe('file_too_large');

    const auth = hostWith();
    filter.catch(new UnauthorizedException('unauthorized'), auth.host);
    expect(auth.json.mock.calls[0][0].code).toBe('unauthorized');
  });

  it('returns 500 without stack, SQL or object keys for unknown errors', () => {
    const { host, json } = hostWith();
    const error = new Error('relation "files" does not exist');

    filter.catch(error, host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: apiErrorCode.internalError,
      requestId: 'req-1',
    });
    expect(JSON.stringify(body)).not.toMatch(/stack|files|does not exist/i);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('maps an unknown Prisma code to 500', () => {
    const { host, json } = hostWith();

    filter.catch(prismaError('P2010'), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: apiErrorCode.internalError,
      requestId: 'req-1',
    });
  });

  it('redacts share tokens in the warning log', () => {
    const { host } = hostWith(
      '/access/public-links/resolve?token=secret-token',
    );

    filter.catch(new NotFoundException('not_found'), host);

    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('token=[redacted]'),
    );
    expect(Logger.prototype.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('secret-token'),
    );
  });
});
