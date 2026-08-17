import { ActivityEventType } from '../../database/generated/prisma/enums';
import type { ActivityEventTypeDto } from '@sdr/shared/activity';

export const ACTIVITY_DEDUP_MS = 15 * 60 * 1000;
export const ACTIVITY_PAGE_SIZE = 20;
export const ACTIVITY_TOP_FILES = 20;

export const ACTIVITY_TYPE_TO_API: Record<
  ActivityEventType,
  ActivityEventTypeDto
> = {
  FILE_VIEWED: 'file_viewed',
  FILE_DOWNLOADED: 'file_downloaded',
  LINK_OPENED: 'link_opened',
  ACCESS_GRANTED: 'access_granted',
  ACCESS_REVOKED: 'access_revoked',
  FILE_DELETED: 'file_deleted',
  FOLDER_DELETED: 'folder_deleted',
};

export const ACTIVITY_TYPE_FROM_API: Record<
  ActivityEventTypeDto,
  ActivityEventType
> = {
  file_viewed: 'FILE_VIEWED',
  file_downloaded: 'FILE_DOWNLOADED',
  link_opened: 'LINK_OPENED',
  access_granted: 'ACCESS_GRANTED',
  access_revoked: 'ACCESS_REVOKED',
  file_deleted: 'FILE_DELETED',
  folder_deleted: 'FOLDER_DELETED',
};

export function userActorKey(userId: string): string {
  return `user:${userId}`;
}

export function linkActorKey(linkId: string): string {
  return `link:${linkId}`;
}

export function parseActorKey(
  key: string,
): { kind: 'user'; userId: string } | { kind: 'link'; linkId: string } | null {
  if (key.startsWith('user:')) {
    const userId = key.slice(5);
    return userId ? { kind: 'user', userId } : null;
  }

  if (key.startsWith('link:')) {
    const linkId = key.slice(5);
    return linkId ? { kind: 'link', linkId } : null;
  }

  return null;
}

export function encodeTimelineCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeTimelineCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = raw.lastIndexOf('|');
    if (separator <= 0) {
      return null;
    }

    const createdAt = new Date(raw.slice(0, separator));
    const id = raw.slice(separator + 1);
    if (!id || Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id };
  } catch {
    return null;
  }
}
