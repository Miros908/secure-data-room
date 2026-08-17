'use client';

import { LOCALES, LOCALE_META } from '@/app/lib/i18n/locale';
import { useT } from '@/app/lib/i18n/use-t';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/menu';
import { useLocaleStore } from '@/store/locale.store';
import { cx } from '@/lib/cx';

type LocaleSwitcherProps = {
  variant?: 'compact' | 'menu';
};

export function LocaleSwitcher({ variant = 'compact' }: LocaleSwitcherProps) {
  const t = useT();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  if (variant === 'menu') {
    return (
      <div className="py-1">
        <p className="px-3 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
          {t.locale.label}
        </p>
        {LOCALES.map((id) => (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={locale === id}
            className={cx(
              'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-muted',
              locale === id ? 'font-medium text-fg' : 'text-fg',
            )}
            onClick={() => setLocale(id)}
          >
            {LOCALE_META[id].nativeLabel}
            {locale === id ? <span aria-hidden>✓</span> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu
      label={t.locale.label}
      align="right"
      actions={LOCALES.map((id) => ({
        id,
        label: LOCALE_META[id].nativeLabel,
        onSelect: () => setLocale(id),
      }))}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.locale.label}
          aria-haspopup="menu"
        >
          <span className="text-[11px] font-semibold tracking-wide">
            {LOCALE_META[locale].shortLabel}
          </span>
        </Button>
      }
    />
  );
}
