'use client';

import { catalog, type Messages } from './catalog';
import { useLocaleStore } from '@/store/locale.store';
import type { Locale } from './locale';

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale);
}

export function useT(): Messages {
  const locale = useLocale();
  return catalog[locale];
}
