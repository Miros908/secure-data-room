'use client';

import Link from 'next/link';
import { useT } from '@/app/lib/i18n/use-t';
import { BrandMark } from '@/components/brand-mark';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { FolderIcon, PdfIcon } from '@/components/ui/icons';

export function HomePage() {
  const t = useT();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-w-0 items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="min-w-0 min-[420px]:hidden">
          <BrandMark href="/" compact />
        </div>
        <div className="hidden min-w-0 min-[420px]:block">
          <BrandMark href="/" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-fg hover:bg-surface-muted"
          >
            {t.auth.signIn}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
        <div className="flex max-w-md flex-col gap-5">
          <h1 className="font-display text-4xl leading-[1.1] font-semibold tracking-tight text-fg sm:text-5xl">
            {t.landing.headline}
          </h1>
          <p className="text-base text-muted">{t.landing.body}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
            >
              {t.auth.signIn}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-muted"
            >
              {t.auth.createAccount}
            </Link>
          </div>
        </div>

        <LandingPreview />
      </main>
    </div>
  );
}

function LandingPreview() {
  const t = useT();

  return (
    <div
      aria-hidden
      className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_64px_rgb(17_29_50/0.12)]"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <img
          src="/dealbox-mark.svg"
          alt=""
          draggable={false}
          className="h-7 w-7 object-contain"
        />
        <span className="h-8 flex-1 rounded-full bg-bg" />
        <span className="h-8 w-8 rounded-full bg-accent/90" />
      </div>
      <div className="flex min-h-64">
        <div className="hidden w-44 shrink-0 flex-col gap-2 border-r border-border p-3 sm:flex">
          <div className="h-8 rounded-lg bg-accent/90" />
          <div className="h-8 rounded-lg bg-surface-muted" />
          <div className="h-8 rounded-lg bg-surface-muted" />
          <div className="h-8 rounded-lg bg-surface-muted" />
          <div className="h-8 rounded-lg bg-surface-muted" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <p className="mb-2 font-display text-lg font-semibold text-fg">
            {t.landing.previewDrive}
          </p>
          <PreviewRow
            icon="folder"
            name={t.landing.previewFolderFinance}
            meta={t.landing.previewDate}
          />
          <PreviewRow
            icon="folder"
            name={t.landing.previewFolderLegal}
            meta={t.landing.previewDate}
          />
          <PreviewRow icon="file" name="NDA" meta={t.landing.previewSize} />
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  icon,
  name,
  meta,
}: {
  icon: 'folder' | 'file';
  name: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
      {icon === 'folder' ? (
        <FolderIcon className="h-5 w-5 text-folder" />
      ) : (
        <PdfIcon className="h-5 w-5" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{name}</span>
      <span className="text-xs text-muted">{meta}</span>
    </div>
  );
}
