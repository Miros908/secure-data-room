export const LOCALES = ['en', 'ru', 'uk'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_META: Record<
  Locale,
  { htmlLang: string; intl: string; nativeLabel: string; shortLabel: string }
> = {
  en: {
    htmlLang: 'en',
    intl: 'en-US',
    nativeLabel: 'English',
    shortLabel: 'EN',
  },
  ru: {
    htmlLang: 'ru',
    intl: 'ru-RU',
    nativeLabel: 'Русский',
    shortLabel: 'RU',
  },
  uk: {
    htmlLang: 'uk',
    intl: 'uk-UA',
    nativeLabel: 'Українська',
    shortLabel: 'UK',
  },
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru' || value === 'uk';
}

export function slavicPlural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) {
    return many;
  }

  if (last > 1 && last < 5) {
    return few;
  }

  if (last === 1) {
    return one;
  }

  return many;
}
