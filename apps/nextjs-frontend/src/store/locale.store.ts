import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from '@/app/lib/i18n/locale';

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'sdr-locale',
      partialize: (state) => ({ locale: state.locale }),
      merge: (persisted, current) => {
        const stored =
          persisted && typeof persisted === 'object'
            ? (persisted as { locale?: unknown }).locale
            : undefined;
        return {
          ...current,
          locale: isLocale(stored) ? stored : current.locale,
        };
      },
    },
  ),
);
