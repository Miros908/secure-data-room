'use client';

import type { AccessSubjectType, GrantRoleDto } from '@sdr/shared/access';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatRemainingShort } from '@/app/components/access-countdown';
import { useIncomingShares } from '@/app/hooks/queries/use-incoming-shares';
import { Button } from '@/components/ui/button';
import { FolderIcon, InboxIcon, PdfIcon } from '@/components/ui/icons';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';
import type { Messages } from '@/app/lib/i18n/en';
import { displayRoomName } from './drive-copy';
import { DriveItemMenu } from './drive-item-menu';
import { driveHref } from './drive-location';
import { matchesDriveQuery } from './drive-sort';

type DriveIncomingViewProps = {
  myRoomId?: string;
  search?: string;
};

type IncomingFilter = 'all' | 'rooms' | 'folders' | 'files';

type IncomingItem = {
  type: AccessSubjectType;
  id: string;
  name: string;
  dataRoomId: string;
  role: GrantRoleDto;
  accessExpiresAt: string | null;
};

export function DriveIncomingView({
  myRoomId,
  search = '',
}: DriveIncomingViewProps) {
  const t = useT();
  const query = useIncomingShares();
  const router = useRouter();
  const [filter, setFilter] = useState<IncomingFilter>('all');
  const items = useMemo(() => {
    const rooms: IncomingItem[] = (query.data?.rooms ?? []).map((room) => ({
      type: 'data_room',
      id: room.id,
      name: displayRoomName(room.name),
      dataRoomId: room.id,
      role: room.role,
      accessExpiresAt: room.accessExpiresAt,
    }));
    const folders: IncomingItem[] = (query.data?.folders ?? []).map((folder) => ({
      type: 'folder',
      id: folder.id,
      name: folder.name,
      dataRoomId: folder.dataRoomId,
      role: folder.role,
      accessExpiresAt: folder.accessExpiresAt,
    }));
    const files: IncomingItem[] = (query.data?.files ?? []).map((file) => ({
      type: 'file',
      id: file.id,
      name: file.name,
      dataRoomId: file.dataRoomId,
      role: file.role,
      accessExpiresAt: file.accessExpiresAt,
    }));

    return [...rooms, ...folders, ...files]
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => matchesDriveQuery(item.name, search));
  }, [filter, query.data, search]);

  if (query.error && query.error.statusCode !== 401) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(query.error)}
        </p>
        <Button type="button" variant="ghost" onClick={() => void query.refetch()}>
          {t.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="drive-incoming"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6"
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          {t.incoming.title}
        </h1>
        <p className="text-sm text-muted">{t.incoming.subtitle}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-1">
        <FilterButton current={filter} value="all" onClick={setFilter}>
          {t.common.all}
        </FilterButton>
        <FilterButton current={filter} value="rooms" onClick={setFilter}>
          {t.incoming.drives}
        </FilterButton>
        <FilterButton current={filter} value="folders" onClick={setFilter}>
          {t.incoming.folders}
        </FilterButton>
        <FilterButton current={filter} value="files" onClick={setFilter}>
          {t.incoming.files}
        </FilterButton>
      </div>

      {query.isPending ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {query.data &&
          query.data.rooms.length + query.data.folders.length + query.data.files.length > 0
            ? t.empty.noResults
            : t.empty.incoming}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {items.map((item) => (
            <li key={`${item.type}:${item.id}`}>
              <div className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-muted">
                <button
                  type="button"
                  onClick={() => openIncomingItem(router, item, myRoomId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <IncomingIcon type={item.type} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {incomingHint(item, t)}
                    </span>
                  </span>
                </button>
                <DriveItemMenu
                  label={t.drive.actions}
                  onOpen={() => openIncomingItem(router, item, myRoomId)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function openIncomingItem(
  router: { push: (href: string) => void },
  item: IncomingItem,
  myRoomId?: string,
) {
  if (item.type === 'file') {
    router.push(
      driveHref({
        fileId: item.id,
        dataRoomId: item.dataRoomId,
        myRoomId,
      }),
    );
    return;
  }

  if (item.type === 'folder') {
    router.push(
      driveHref({
        folderId: item.id,
        dataRoomId: item.dataRoomId,
        myRoomId,
      }),
    );
    return;
  }

  router.push(driveHref({ dataRoomId: item.id, myRoomId }));
}

function IncomingIcon({ type }: { type: AccessSubjectType }) {
  if (type === 'file') {
    return <PdfIcon className="h-5 w-5 shrink-0" />;
  }

  if (type === 'folder') {
    return <FolderIcon className="h-5 w-5 shrink-0 text-folder" />;
  }

  return <InboxIcon className="h-5 w-5 shrink-0" />;
}

function matchesFilter(item: IncomingItem, filter: IncomingFilter): boolean {
  if (filter === 'rooms') {
    return item.type === 'data_room';
  }

  if (filter === 'folders') {
    return item.type === 'folder';
  }

  if (filter === 'files') {
    return item.type === 'file';
  }

  return true;
}

function incomingHint(item: IncomingItem, t: Messages): string {
  const typeLabel =
    item.type === 'data_room'
      ? t.common.drive
      : item.type === 'folder'
        ? t.common.folder
        : t.common.file;
  const roleLabel =
    item.role === 'editor' ? t.common.editor : t.common.viewer;
  const remaining = item.accessExpiresAt
    ? formatRemainingShort(item.accessExpiresAt)
    : null;
  return remaining
    ? `${typeLabel} · ${roleLabel} · ${remaining}`
    : `${typeLabel} · ${roleLabel}`;
}

function FilterButton({
  current,
  value,
  onClick,
  children,
}: {
  current: IncomingFilter;
  value: IncomingFilter;
  onClick: (value: IncomingFilter) => void;
  children: string;
}) {
  const active = current === value;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cx(
        'h-8 rounded-full px-3 text-sm',
        active
          ? 'bg-surface-muted font-medium text-fg'
          : 'text-muted hover:bg-surface-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
