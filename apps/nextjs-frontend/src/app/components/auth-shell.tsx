'use client';

import type { ReactNode } from 'react';
import { useT } from '@/app/lib/i18n/use-t';
import { BrandMark } from '@/components/brand-mark';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-navy px-10 py-10 text-white lg:flex lg:w-[42%]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-8%,rgb(46_107_255/0.4),transparent_52%)]"
        />
        <div className="relative z-10">
          <BrandMark href="/" inverse />
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="font-display text-4xl leading-tight font-semibold">
            {t.auth.asideTitle}
          </p>
          <p className="mt-4 text-sm text-white/75">{t.auth.asideBody}</p>
        </div>
        <p className="relative z-10 text-xs text-white/50">DealBox</p>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex min-w-0 items-center justify-between px-5 py-4 lg:px-8">
          <BrandMark href="/" className="lg:hidden" />
          <span className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-16">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex flex-col gap-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
                {title}
              </h1>
              <p className="text-sm text-muted">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
