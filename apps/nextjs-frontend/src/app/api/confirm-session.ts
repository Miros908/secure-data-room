import type { MeResponse } from '@sdr/shared/auth';
import { ApiRequestError } from '@/infrastructure/http/api-error';
import { getMe } from './get-me.fetcher';

export async function confirmSession(
  unauthorizedCode = 'session_cookie_blocked',
): Promise<MeResponse> {
  try {
    return await getMe();
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      throw new ApiRequestError({
        statusCode: 401,
        code: unauthorizedCode,
        requestId: error.requestId,
      });
    }

    throw error;
  }
}
