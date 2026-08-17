'use client';

import { Button } from '@/components/ui/button';
import { MoonIcon, SunIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { useThemeStore } from '@/store/theme.store';

type ThemeToggleProps = {
  variant?: 'icon' | 'row';
};

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const t = useT();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';
  const label = isDark ? t.theme.light : t.theme.dark;

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg hover:bg-surface-muted"
      >
        {isDark ? (
          <SunIcon className="h-4 w-4 text-muted" />
        ) : (
          <MoonIcon className="h-4 w-4 text-muted" />
        )}
        {label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </Button>
  );
}
