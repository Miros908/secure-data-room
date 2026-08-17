import { getMessages } from '@/app/lib/i18n/get-messages';
import type { ApiRequestError } from '@/infrastructure/http/api-error';

export function apiErrorMessage(
  error: ApiRequestError,
  overrides: Record<string, string> = {},
): string {
  const t = getMessages();
  const defaults: Record<string, string> = {
    validation_error: t.errors.validation_error,
    unauthorized: t.errors.unauthorized,
    forbidden: t.errors.forbidden,
    not_found: t.errors.not_found,
    conflict: t.errors.conflict,
    name_taken: t.errors.name_taken,
    already_granted: t.errors.already_granted,
    already_covered: t.errors.already_covered,
    already_invited: t.errors.already_invited,
    already_shared: t.errors.already_shared,
    cannot_grant_self: t.errors.cannot_grant_self,
    cannot_invite_self: t.errors.cannot_invite_self,
    cannot_grant_owner: t.errors.cannot_grant_owner,
    cannot_invite_owner: t.errors.cannot_invite_owner,
    invalid_destination: t.errors.invalid_destination,
    folder_too_deep: t.errors.folder_too_deep,
    invalid_expires_at: t.errors.invalid_expires_at,
    file_too_large: t.errors.file_too_large,
    file_required: t.errors.file_required,
    too_many_requests: t.errors.too_many_requests,
    network_error: t.errors.network_error,
    internal_error: t.errors.internal_error,
    session_cookie_blocked: t.errors.session_cookie_blocked,
    register_unconfirmed: t.errors.register_unconfirmed,
  };

  return overrides[error.code] ?? defaults[error.code] ?? t.errors.fallback;
}
