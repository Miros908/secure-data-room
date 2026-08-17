'use client';

import type { ListDataRoomsResponse } from '@sdr/shared/data-rooms';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DriveIcon,
  InboxIcon,
  SentIcon,
  ActivityIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';
import { DriveCreateMenu } from './drive-create-menu';
import { driveHref, type DriveView } from './drive-location';

type DriveSidebarProps = {
  rooms?: ListDataRoomsResponse;
  isLoading: boolean;
  hasError?: boolean;
  activeRoomId?: string;
  myRoomId?: string;
  view?: DriveView;
  collapsed: boolean;
  mobileOpen: boolean;
  canCreate: boolean;
  onCloseMobile: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
};

export function DriveSidebar({
  rooms,
  isLoading,
  hasError = false,
  activeRoomId,
  myRoomId,
  view = 'folder',
  collapsed,
  mobileOpen,
  canCreate,
  onCloseMobile,
  onCreateFolder,
  onUpload,
}: DriveSidebarProps) {
  const t = useT();
  const myActive =
    view === 'folder' &&
    Boolean(rooms?.myRoom && rooms.myRoom.id === activeRoomId);
  const incomingActive =
    view === 'incoming' ||
    (view === 'folder' &&
      Boolean(rooms?.myRoom && activeRoomId && activeRoomId !== rooms.myRoom.id));

  const nav = (
    <nav
      aria-label={t.nav.sections}
      className={cx(
        'flex h-full flex-col gap-4 overflow-y-auto p-3',
        collapsed ? 'items-center px-2' : '',
      )}
    >
      <DriveCreateMenu
        disabled={!canCreate}
        onCreateFolder={() => {
          onCloseMobile();
          onCreateFolder();
        }}
        onUpload={() => {
          onCloseMobile();
          onUpload();
        }}
        fullWidth={!collapsed}
        compact={collapsed}
      />

      <section className={cx('flex flex-col gap-0.5', collapsed ? 'w-full items-center' : '')}>
        {isLoading ? (
          <div className="h-9 w-full animate-pulse rounded-lg bg-surface-muted" />
        ) : rooms?.myRoom ? (
          <NavLink
            href={driveHref({ dataRoomId: rooms.myRoom.id, myRoomId })}
            active={myActive}
            collapsed={collapsed}
            icon={<DriveIcon className="h-5 w-5" />}
            label={t.nav.myDrive}
          />
        ) : hasError ? (
          <p className="px-2 text-sm text-danger">{t.nav.loadFailed}</p>
        ) : (
          <p className="px-2 text-sm text-muted">{t.nav.openDriveFailed}</p>
        )}

        <NavLink
          href={driveHref({ view: 'incoming' })}
          active={incomingActive}
          collapsed={collapsed}
          icon={<InboxIcon className="h-5 w-5" />}
          label={t.nav.sharedWithMe}
        />
        <NavLink
          href={driveHref({ view: 'outgoing' })}
          active={view === 'outgoing'}
          collapsed={collapsed}
          icon={<SentIcon className="h-5 w-5" />}
          label={t.nav.sharedByMe}
        />
        {rooms?.myRoom ? (
          <NavLink
            href={driveHref({ view: 'activity' })}
            active={view === 'activity'}
            collapsed={collapsed}
            icon={<ActivityIcon className="h-5 w-5" />}
            label={t.nav.activity}
          />
        ) : null}
      </section>
    </nav>
  );

  return (
    <>
      <aside
        className={cx(
          'hidden shrink-0 border-r border-border bg-surface md:block',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        {nav}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            className="absolute inset-0 bg-fg/40"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 flex h-full w-[min(18rem,86vw)] flex-col bg-surface">
            <div className="flex items-center justify-end p-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCloseMobile}>
                {t.common.close}
              </Button>
            </div>
            <div className="min-h-0 flex-1">{nav}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function NavLink({
  href,
  active,
  collapsed,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 rounded-lg text-sm transition-colors',
        collapsed ? 'h-10 w-10 justify-center' : 'px-2 py-2',
        active
          ? 'bg-surface-muted font-medium text-fg'
          : 'text-muted hover:bg-surface-muted hover:text-fg',
      )}
    >
      <span className="shrink-0">{icon}</span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="min-w-0 truncate">{label}</span>
      )}
    </Link>
  );
}
