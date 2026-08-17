import { getLocale } from '@/app/lib/i18n/get-messages';
import { getMessages } from '@/app/lib/i18n/get-messages';
import { LOCALE_META } from '@/app/lib/i18n/locale';

function intlLocale() {
  return LOCALE_META[getLocale()].intl;
}

export function formatAccessUntil(value: string): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDriveDate(value: string): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(value))
    .replace(/\s*г\.?\s*$/u, '');
}

export function formatActivityTime(value: string): string {
  return formatAccessUntil(value);
}

export function formatVersionCount(count: number): string | null {
  if (count <= 1) {
    return null;
  }

  return getMessages().format.versions(count);
}

export function formatBytes(bytes: number): string {
  const t = getMessages().format;
  if (bytes < 1024) {
    return `${bytes} ${t.byte}`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${formatNumber(kilobytes)} ${t.kilobyte}`;
  }

  return `${formatNumber(kilobytes / 1024)} ${t.megabyte}`;
}

function formatNumber(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

export function driveItemKey(kind: 'folder' | 'file', id: string): string {
  return `${kind}:${id}`;
}

export function parseDriveItemKey(
  key: string,
): { kind: 'folder' | 'file'; id: string } | null {
  const [kind, ...rest] = key.split(':');
  const id = rest.join(':');
  if ((kind !== 'folder' && kind !== 'file') || !id) {
    return null;
  }

  return { kind, id };
}
