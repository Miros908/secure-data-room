'use client';

import type { AuthUser } from '@sdr/shared/auth';
import { AccountMenu } from '@/components/account-menu';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { MenuIcon, SearchIcon, SidebarIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';

type DriveHeaderProps = {
  user: AuthUser;
  search: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onToggleMobileNav: () => void;
  onToggleSidebar: () => void;
};

export function DriveHeader({
  user,
  search,
  searchPlaceholder,
  onSearchChange,
  onToggleMobileNav,
  onToggleSidebar,
}: DriveHeaderProps) {
  const t = useT();
  const placeholder = searchPlaceholder ?? t.search.drive;
  return (
    <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-2 border-b border-border bg-bg/90 px-2 backdrop-blur-md sm:gap-3 sm:px-4">
      <div className="shrink-0 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.nav.menu}
          onClick={onToggleMobileNav}
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
      </div>
      <div className="hidden shrink-0 md:block">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.nav.collapseSidebar}
          onClick={onToggleSidebar}
        >
          <SidebarIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="hidden shrink-0 min-[420px]:block">
        <BrandMark href="/drive" />
      </div>
      <div className="shrink-0 min-[420px]:hidden">
        <BrandMark href="/drive" compact />
      </div>

      <label className="relative mx-auto min-w-0 flex-1 max-w-2xl">
        <span className="sr-only">{t.search.label}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id="drive-search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onSearchChange('');
              event.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={cx(
            'h-10 w-full rounded-full border border-border bg-surface py-0 pr-3 pl-10 text-sm text-fg outline-none transition-colors',
            'placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        />
      </label>

      <AccountMenu user={user} />
    </header>
  );
}
