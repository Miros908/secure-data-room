import { catalog, type Messages } from './catalog';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { useLocaleStore } from '@/store/locale.store';

export function getLocale(): Locale {
  return useLocaleStore.getState().locale ?? DEFAULT_LOCALE;
}

export function getMessages(locale: Locale = getLocale()): Messages {
  return catalog[locale];
}
