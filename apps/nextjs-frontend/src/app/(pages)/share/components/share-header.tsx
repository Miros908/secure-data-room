'use client';

import type { AuthUser } from '@sdr/shared/auth';
import Link from 'next/link';
import { AccessCountdown } from '@/app/components/access-countdown';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { liveAccessClosed } from '@/app/lib/live-access-copy';
import { BrandMark } from '@/components/brand-mark';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { useT } from '@/app/lib/i18n/use-t';

type ShareHeaderProps = {
  user: AuthUser | null;
  isUserPending?: boolean;
  accessExpiresAt?: string | null;
  onAccessExpired?: () => void;
};

export function ShareHeader({
  user,
  isUserPending = false,
  accessExpiresAt,
  onAccessExpired,
}: ShareHeaderProps) {
  const t = useT();
  const notice = useLiveNotice();
  const showCountdown = Boolean(accessExpiresAt) && !liveAccessClosed(notice);

  return (
    <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-2.5 backdrop-blur sm:px-6">
      <div className="min-w-0 min-[420px]:hidden">
        <BrandMark href={user ? '/drive' : '/'} compact />
      </div>
      <div className="hidden min-w-0 min-[420px]:block">
        <BrandMark href={user ? '/drive' : '/'} />
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {showCountdown && accessExpiresAt ? (
          <AccessCountdown
            expiresAt={accessExpiresAt}
            onExpired={onAccessExpired}
            className="hidden truncate sm:block"
          />
        ) : null}
        <LocaleSwitcher />
        <ThemeToggle />
        {isUserPending ? null : user ? (
          <Link
            href="/drive"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted"
          >
            {t.sharePage.myDrive}
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent-strong"
          >
            {t.auth.signIn}
          </Link>
        )}
      </div>
    </header>
  );
}
