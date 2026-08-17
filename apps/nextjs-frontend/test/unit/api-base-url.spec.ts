import { afterEach, describe, expect, it } from 'vitest';
import {
  apiBaseURL,
  uploadApiBaseURL,
  usesCrossOriginUpload,
} from '@/infrastructure/http/api-base-url';

describe('apiBaseURL', () => {
  afterEach(() => {
    window.location.href = 'http://localhost:3000/';
  });

  it('defaults to local Nest', () => {
    expect(apiBaseURL({})).toBe('http://localhost:4000');
    expect(usesCrossOriginUpload({})).toBe(false);
  });

  it('treats /backend and the Render origin as cross-origin upload', () => {
    const env = {
      NEXT_PUBLIC_API_URL: '/backend',
      NEXT_PUBLIC_UPLOAD_API_URL: 'https://secure-data-room.onrender.com',
    };
    expect(apiBaseURL(env)).toBe('/backend');
    expect(uploadApiBaseURL(env)).toBe(
      'https://secure-data-room.onrender.com',
    );
    expect(usesCrossOriginUpload(env)).toBe(true);
  });

  it('forces same-origin /backend on a hosted page even if env points at the API host', () => {
    window.location.href = 'https://deal-box.vercel.app/login';
    expect(
      apiBaseURL({
        NEXT_PUBLIC_API_URL: 'https://secure-data-room.onrender.com',
      }),
    ).toBe('/backend');
  });
});
