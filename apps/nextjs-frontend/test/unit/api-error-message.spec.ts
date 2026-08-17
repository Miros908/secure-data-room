import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '@/lib/api-error-message';
import { apiError } from '../api-error';

describe('apiErrorMessage', () => {
  it('maps known codes and keeps login unauthorized distinct', () => {
    expect(apiErrorMessage(apiError({ code: 'name_taken', statusCode: 409 }))).toBe(
      'This name is already taken',
    );
    expect(
      apiErrorMessage(apiError({ code: 'already_covered', statusCode: 409 })),
    ).toBe('This person already has access from a parent folder or Drive');
    expect(
      apiErrorMessage(apiError({ code: 'unauthorized', statusCode: 401 }), {
        unauthorized: 'Wrong email or password',
      }),
    ).toBe('Wrong email or password');
    expect(
      apiErrorMessage(apiError({ code: 'unauthorized', statusCode: 401 })),
    ).toBe('Sign in');
    expect(
      apiErrorMessage(
        apiError({ code: 'session_cookie_blocked', statusCode: 401 }),
      ),
    ).toBe(
      'This browser blocked the sign-in cookie. Open the site in Safari or Chrome, not inside another app.',
    );
    expect(
      apiErrorMessage(
        apiError({ code: 'register_unconfirmed', statusCode: 401 }),
      ),
    ).toBe("Couldn't start a session. If you already have an account, sign in.");
  });

  it('falls back when the code is unknown', () => {
    expect(apiErrorMessage(apiError({ code: 'new_backend_code', statusCode: 400 }))).toBe(
      'Something went wrong',
    );
  });
});
