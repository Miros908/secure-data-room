'use client';

import { useT } from '@/app/lib/i18n/use-t';

export function ShareLoading() {
  const t = useT();
  return (
    <div
      className="flex min-h-dvh flex-col bg-bg"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="h-14 border-b border-border" />
      <div className="flex-1 space-y-4 p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      </div>
      <span className="sr-only">{t.sharePage.loadingLink}</span>
    </div>
  );
}

export function ShareListSkeleton() {
  const t = useT();
  return (
    <div className="space-y-2 p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <div className="h-5 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="space-y-2 pt-4">
        <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
      </div>
      <span className="sr-only">{t.sharePage.loadingContents}</span>
    </div>
  );
}
