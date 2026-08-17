import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiRequestError, toApiRequestError } from '@/infrastructure/http/api-error';

describe('toApiRequestError', () => {
  it('keeps an existing ApiRequestError', () => {
    const original = new ApiRequestError({
      code: 'not_found',
      statusCode: 404,
      requestId: 'r1',
    });
    expect(toApiRequestError(original)).toBe(original);
  });

  it('maps axios without a response to network_error', () => {
    const error = new AxiosError('offline');
    const mapped = toApiRequestError(error);
    expect(mapped.code).toBe('network_error');
    expect(mapped.statusCode).toBe(0);
  });

  it('maps a well-formed API body', () => {
    const error = new AxiosError(
      'conflict',
      'ERR_BAD_REQUEST',
      { headers: new AxiosHeaders() },
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          code: 'name_taken',
          statusCode: 409,
          requestId: 'req-9',
        },
      },
    );
    const mapped = toApiRequestError(error);
    expect(mapped.code).toBe('name_taken');
    expect(mapped.requestId).toBe('req-9');
  });

  it('maps a malformed body to internal_error', () => {
    const error = new AxiosError(
      'oops',
      'ERR_BAD_RESPONSE',
      { headers: new AxiosHeaders() },
      undefined,
      {
        status: 500,
        statusText: 'Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: 'not-json-contract',
      },
    );
    const mapped = toApiRequestError(error);
    expect(mapped.code).toBe('internal_error');
    expect(mapped.statusCode).toBe(500);
  });
});
