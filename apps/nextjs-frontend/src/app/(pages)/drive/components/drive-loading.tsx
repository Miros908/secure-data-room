'use client';

import { useT } from '@/app/lib/i18n/use-t';

export function DriveLoading() {
  const t = useT();
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-bg"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="h-14 border-b border-border" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-64 border-r border-border md:block">
          <div className="space-y-3 p-3">
            <div className="h-9 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-9 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-9 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="hidden grid-cols-[minmax(0,1fr)_4.75rem_7.5rem_5.25rem] gap-3 sm:grid">
            <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
            <div className="h-3 w-12 animate-pulse rounded bg-surface-muted justify-self-end" />
            <div className="h-3 w-14 animate-pulse rounded bg-surface-muted justify-self-end" />
            <div className="h-3 w-10 animate-pulse rounded bg-surface-muted justify-self-end" />
          </div>
          <div className="space-y-2">
            <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </div>
      </div>
      <span className="sr-only">{t.drive.loadingDrive}</span>
    </div>
  );
}
