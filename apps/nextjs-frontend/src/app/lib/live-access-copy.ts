import type { LiveEvent } from '@sdr/shared/events';
import { getMessages } from '@/app/lib/i18n/get-messages';

export function liveFileNotFoundMessage(
  notice: LiveEvent | null,
): string | undefined {
  if (!notice) {
    return undefined;
  }

  const t = getMessages().live;

  if (notice.type === 'access_invalidated') {
    return t.fileRevoked;
  }

  if (notice.type === 'resource_gone') {
    return t.fileDeleted;
  }

  return undefined;
}

export function liveAccessClosed(notice: LiveEvent | null): boolean {
  return (
    notice?.type === 'access_invalidated' || notice?.type === 'resource_gone'
  );
}

export function liveFolderNotFoundMessage(
  notice: LiveEvent | null,
): string | undefined {
  if (!notice || notice.type === 'activity_recorded') {
    return undefined;
  }

  return getMessages().live.folderGone;
}
