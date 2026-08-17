import { describe, expect, it, vi } from 'vitest';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { apiError } from '../api-error';

describe('applyApiIssues', () => {
  it('returns false when there are no field issues', () => {
    const setError = vi.fn();
    expect(
      applyApiIssues(apiError({ code: 'name_taken', statusCode: 409 }), setError),
    ).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('copies issues onto the matching form fields', () => {
    const setError = vi.fn();
    const applied = applyApiIssues(
      apiError({
        code: 'validation_error',
        statusCode: 400,
        issues: [{ path: 'email', message: 'Invalid email' }],
      }),
      setError,
    );
    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Invalid email',
    });
  });
});
