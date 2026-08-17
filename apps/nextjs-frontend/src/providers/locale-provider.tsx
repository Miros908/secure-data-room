'use client';

import { useEffect, type ReactNode } from 'react';
import { LOCALE_META } from '@/app/lib/i18n/locale';
import { useLocaleStore } from '@/store/locale.store';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.lang = LOCALE_META[locale].htmlLang;
  }, [locale]);

  return <>{children}</>;
}
