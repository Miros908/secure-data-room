import { BadRequestException } from '@nestjs/common';
import { MAX_ACCESS_TTL_MS } from '../access.constants';

export function parseAccessExpiresAt(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const expiresAt = new Date(value);
  const now = Date.now();

  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= now ||
    expiresAt.getTime() > now + MAX_ACCESS_TTL_MS
  ) {
    throw new BadRequestException('invalid_expires_at');
  }

  return expiresAt;
}

export function mergeAccessExpiry(dates: Array<Date | null>): Date | null {
  if (dates.length === 0 || dates.some((date) => date === null)) {
    return null;
  }

  const finite = dates.filter((date): date is Date => date !== null);
  return new Date(Math.max(...finite.map((date) => date.getTime())));
}

export function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function remainingAccessTtlSeconds(
  accessExpiresAt: Date | null,
  defaultTtlSeconds: number,
  minTtlSeconds: number,
): number {
  if (!accessExpiresAt) {
    return defaultTtlSeconds;
  }

  const remaining = Math.floor((accessExpiresAt.getTime() - Date.now()) / 1000);
  return Math.min(defaultTtlSeconds, Math.max(minTtlSeconds, remaining));
}

export function inviteAcceptDeadline(
  accessExpiresAt: Date | null,
  inviteTtlMs: number,
): Date {
  const inviteDeadline = new Date(Date.now() + inviteTtlMs);
  if (
    !accessExpiresAt ||
    accessExpiresAt.getTime() >= inviteDeadline.getTime()
  ) {
    return inviteDeadline;
  }

  return accessExpiresAt;
}
