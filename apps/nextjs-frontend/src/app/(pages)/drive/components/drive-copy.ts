import { getMessages } from '@/app/lib/i18n/get-messages';

const LEGACY_ROOM_NAMES = new Set([
  'Data Room',
  'Комната',
  'Мой диск',
  'My Drive',
  'Мій диск',
]);

export function displayRoomName(
  name: string | undefined | null,
  isOwn = false,
): string {
  const t = getMessages();

  if (isOwn) {
    return t.nav.myDrive;
  }

  if (!name || LEGACY_ROOM_NAMES.has(name)) {
    return t.common.drive;
  }

  return name;
}
