import { ApiRequestError } from '@/infrastructure/http/api-error';
import type { ApiError } from '@sdr/shared/http';

export function apiError(
  payload: Pick<ApiError, 'code' | 'statusCode'> & Partial<ApiError>,
): ApiRequestError {
  return new ApiRequestError({
    requestId: 'test-request',
    ...payload,
  });
}

export const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'owner@example.com',
  name: 'Owner',
};

export const FILE_DETAIL = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'term-sheet.pdf',
  dataRoomId: '33333333-3333-4333-8333-333333333333',
  folderId: null,
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  versionNumber: 1,
  versionCount: 1,
  currentVersionId: '44444444-4444-4444-8444-444444444444',
  createdAt: '2026-08-16T12:00:00.000Z',
  role: 'owner' as const,
  accessExpiresAt: null,
  downloadUrl: 'about:blank',
  downloadUrlExpiresAt: '2026-09-01T00:00:00.000Z',
};
