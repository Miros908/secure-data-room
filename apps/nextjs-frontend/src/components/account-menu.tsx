'use client';

import type { AuthUser } from '@sdr/shared/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '@/app/hooks/mutations/use-logout';
import { Button } from '@/components/ui/button';
import { LogoutIcon } from '@/components/ui/icons';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserAvatar } from '@/components/user-avatar';
import { useT } from '@/app/lib/i18n/use-t';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useToastStore } from '@/store/toast.store';

type AccountMenuProps = {
  user: AuthUser;
};

export function AccountMenu({ user }: AccountMenuProps) {
  const t = useT();
  const router = useRouter();
  const logout = useLogout();
  const pushToast = useToastStore((state) => state.push);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.replace('/login'),
      onError: (error) => pushToast(apiErrorMessage(error), 'danger'),
    });
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        className="gap-2 px-1.5 sm:px-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.account.menu}
        onClick={() => setOpen((current) => !current)}
      >
        <UserAvatar name={user.name} email={user.email} />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">
          {user.name}
        </span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface py-2 shadow-[0_16px_40px_rgb(17_29_50/0.14)] dark:shadow-[0_16px_40px_rgb(0_0_0/0.45)]"
        >
          <div className="border-b border-border px-3 pb-3">
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <ThemeToggle variant="row" />
          <LocaleSwitcher variant="menu" />
          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg hover:bg-surface-muted disabled:opacity-55"
            onClick={onLogout}
          >
            <LogoutIcon className="h-4 w-4 text-muted" />
            {logout.isPending ? t.account.signingOut : t.account.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
