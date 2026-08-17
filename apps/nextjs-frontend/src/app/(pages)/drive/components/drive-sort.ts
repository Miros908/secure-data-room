import type { DriveSortDir, DriveSortKey } from '@/store/drive-ui.store';
import { getLocale } from '@/app/lib/i18n/get-messages';
import { LOCALE_META } from '@/app/lib/i18n/locale';

type Named = { name: string; createdAt: string };
type Sized = Named & { sizeBytes?: number };

export function sortDriveEntries<T extends Sized>(
  items: T[],
  key: DriveSortKey,
  dir: DriveSortDir,
): T[] {
  const copy = [...items];
  copy.sort((left, right) => {
    let result = 0;
    if (key === 'name') {
      result = left.name.localeCompare(right.name, LOCALE_META[getLocale()].intl, {
        numeric: true,
        sensitivity: 'base',
      });
    } else if (key === 'date') {
      result = left.createdAt.localeCompare(right.createdAt);
    } else {
      result = (left.sizeBytes ?? -1) - (right.sizeBytes ?? -1);
    }

    return dir === 'asc' ? result : -result;
  });
  return copy;
}

export function matchesDriveQuery(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return name.toLowerCase().includes(needle);
}
