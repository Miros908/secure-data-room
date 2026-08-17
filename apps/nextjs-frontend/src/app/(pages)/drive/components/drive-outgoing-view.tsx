'use client';

import type { AccessSubjectType, OutgoingShareItem } from '@sdr/shared/access';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useOutgoingShares } from '@/app/hooks/queries/use-outgoing-shares';
import { Button } from '@/components/ui/button';
import { FolderIcon, PdfIcon } from '@/components/ui/icons';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';
import type { Messages } from '@/app/lib/i18n/en';
import { displayRoomName } from './drive-copy';
import { DriveAccessDialog } from './drive-access-panel';
import { DriveAccessStatus } from './drive-access-status';
import { DriveItemMenu } from './drive-item-menu';
import {
  driveOpenInFolderHref,
  type DriveAccessSubject,
} from './drive-location';
import { matchesDriveQuery } from './drive-sort';

type DriveOutgoingViewProps = {
  myRoomId?: string;
  access?: DriveAccessSubject;
  search?: string;
  onOpenAccess: (subject: DriveAccessSubject & { name: string }) => void;
  onCloseAccess: () => void;
  onOpenSource: (source: {
    type: AccessSubjectType;
    id: string;
    name: string;
    dataRoomId: string;
  }) => void;
};

type OutgoingFilter = 'all' | 'links' | 'people' | 'pending';

export function DriveOutgoingView({
  myRoomId,
  access,
  search = '',
  onOpenAccess,
  onCloseAccess,
  onOpenSource,
}: DriveOutgoingViewProps) {
  const t = useT();
  const query = useOutgoingShares();
  const router = useRouter();
  const [filter, setFilter] = useState<OutgoingFilter>('all');
  const items = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((item) => matchesFilter(item, filter))
        .filter((item) =>
          matchesDriveQuery(item.name, search) ||
          matchesDriveQuery(outgoingItemName(item), search),
        ),
    [filter, query.data?.items, search],
  );
  const selected = query.data?.items.find(
    (item) => access && item.type === access.type && item.id === access.id,
  );

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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          {t.outgoing.title}
        </h1>
        <p className="text-sm text-muted">{t.outgoing.subtitle}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-1">
        <FilterButton current={filter} value="all" onClick={setFilter}>
          {t.common.all}
        </FilterButton>
        <FilterButton current={filter} value="links" onClick={setFilter}>
          {t.outgoing.links}
        </FilterButton>
        <FilterButton current={filter} value="people" onClick={setFilter}>
          {t.outgoing.people}
        </FilterButton>
        <FilterButton current={filter} value="pending" onClick={setFilter}>
          {t.outgoing.invites}
        </FilterButton>
      </div>

      {query.isPending ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {query.data?.items.length || search.trim()
            ? t.empty.noResults
            : t.empty.outgoing}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {items.map((item) => {
            const isActive =
              access?.type === item.type && access.id === item.id;
            const name = outgoingItemName(item);

            return (
              <li key={`${item.type}:${item.id}`}>
                <div
                  className={cx(
                    'group flex items-center gap-2 rounded-lg px-2 py-2',
                    isActive ? 'bg-accent/10' : 'hover:bg-surface-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAccess({
                        type: item.type,
                        id: item.id,
                        name,
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {item.type === 'file' ? (
                      <PdfIcon className="h-5 w-5 shrink-0" />
                    ) : (
                      <FolderIcon className="h-5 w-5 shrink-0 text-folder" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {itemTypeLabel(item.type, t)}
                        {item.path.length > 0
                          ? ` · ${item.path.map((crumb) => crumb.name).join(' / ')}`
                          : ''}
                      </span>
                    </span>
                  </button>
                  <div className="hidden sm:block">
                    <DriveAccessStatus
                      compact
                      sharing={{
                        peopleCount: item.peopleCount,
                        pendingCount: item.pendingCount,
                        hasPublicLink: item.hasPublicLink,
                        inheritedFrom: null,
                      }}
                      onOpenDirect={() =>
                        onOpenAccess({
                          type: item.type,
                          id: item.id,
                          name,
                        })
                      }
                    />
                  </div>
                  <DriveItemMenu
                    label={t.drive.actions}
                    onShare={() =>
                      onOpenAccess({
                        type: item.type,
                        id: item.id,
                        name,
                      })
                    }
                    onShowInFolder={() =>
                      router.push(
                        driveOpenInFolderHref({
                          type: item.type,
                          id: item.id,
                          dataRoomId: item.dataRoomId,
                          parentFolderId: item.parentFolderId,
                          myRoomId,
                        }),
                      )
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {access ? (
        <DriveAccessDialog
          type={access.type}
          id={access.id}
          name={selected ? outgoingItemName(selected) : t.common.file}
          onClose={onCloseAccess}
          onOpenSource={onOpenSource}
        />
      ) : null}
    </div>
  );
}

function outgoingItemName(item: Pick<OutgoingShareItem, 'type' | 'name'>): string {
  return item.type === 'data_room' ? displayRoomName(item.name, true) : item.name;
}

function matchesFilter(item: OutgoingShareItem, filter: OutgoingFilter): boolean {
  if (filter === 'links') {
    return item.hasPublicLink;
  }

  if (filter === 'people') {
    return item.peopleCount > 0;
  }

  if (filter === 'pending') {
    return item.pendingCount > 0;
  }

  return true;
}

function itemTypeLabel(type: AccessSubjectType, t: Messages): string {
  if (type === 'data_room') {
    return t.common.drive;
  }

  if (type === 'folder') {
    return t.common.folder;
  }

  return t.common.file;
}

function FilterButton({
  current,
  value,
  onClick,
  children,
}: {
  current: OutgoingFilter;
  value: OutgoingFilter;
  onClick: (value: OutgoingFilter) => void;
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
