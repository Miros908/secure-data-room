'use client';

import type { ReactNode } from 'react';
import { useMe } from '@/app/hooks/queries/use-me';
import { useRedirectAuthorized } from '@/app/hooks/use-redirect-authorized';
import { useT } from '@/app/lib/i18n/use-t';

export function GuestOnly({ children }: { children: ReactNode }) {
  const t = useT();
  const me = useMe();
  const hasSession = me.isSuccess && Boolean(me.data);
  useRedirectAuthorized(hasSession);

  if (me.isPending || hasSession) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <span className="sr-only">{t.auth.loading}</span>
      </div>
    );
  }

  return children;
}
