import { apiErrorCode, apiErrorSchema, type ApiError } from '@sdr/shared/http';
import { AxiosError } from 'axios';

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string;
  readonly issues: ApiError['issues'];

  constructor(payload: ApiError) {
    super(payload.code);
    this.name = 'ApiRequestError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.issues = payload.issues;
  }

  get isValidationError(): boolean {
    return this.code === apiErrorCode.validationError;
  }
}

const OFFLINE_ERROR: ApiError = {
  statusCode: 0,
  code: 'network_error',
  requestId: 'unknown',
};

export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiRequestError(OFFLINE_ERROR);
    }

    const parsed = apiErrorSchema.safeParse(error.response.data);
    if (parsed.success) {
      return new ApiRequestError(parsed.data);
    }

    return new ApiRequestError({
      statusCode: error.response.status,
      code: apiErrorCode.internalError,
      requestId: 'unknown',
    });
  }

  return new ApiRequestError({
    ...OFFLINE_ERROR,
    code: apiErrorCode.internalError,
  });
}
