import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function applyApiIssues<T extends FieldValues>(
  error: ApiRequestError,
  setError: UseFormSetError<T>,
): boolean {
  if (!error.issues?.length) {
    return false;
  }

  let applied = false;
  for (const issue of error.issues) {
    if (!issue.path) {
      continue;
    }
    setError(issue.path as Path<T>, { type: 'server', message: issue.message });
    applied = true;
  }

  return applied;
}
