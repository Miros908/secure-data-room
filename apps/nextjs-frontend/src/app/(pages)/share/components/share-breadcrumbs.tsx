'use client';

import type { FolderContents } from '@sdr/shared/folders';
import Link from 'next/link';
import { ChevronRightIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { shareHref } from './share-location';

type ShareBreadcrumbsProps = {
  token: string;
  roomName: string;
  canOpenRoomRoot: boolean;
  rootFolderId?: string;
  contents: FolderContents;
};

export function ShareBreadcrumbs({
  token,
  roomName,
  canOpenRoomRoot,
  rootFolderId,
  contents,
}: ShareBreadcrumbsProps) {
  const t = useT();

  if (rootFolderId) {
    return (
      <FolderShareCrumbs
        token={token}
        rootFolderId={rootFolderId}
        contents={contents}
      />
    );
  }

  const atRoot = !contents.folder;
  const crumbs = contents.breadcrumbs;
  const current = atRoot ? roomName : (crumbs.at(-1)?.name ?? roomName);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {!atRoot ? (
        <nav aria-label={t.drive.breadcrumbs}>
          <ol className="flex flex-wrap items-center gap-0.5 text-sm">
            <li>
              {canOpenRoomRoot ? (
                <Link
                  href={shareHref({ token })}
                  className="rounded-md px-1 text-muted hover:text-fg"
                >
                  {roomName}
                </Link>
              ) : (
                <span className="px-1 text-muted">{roomName}</span>
              )}
            </li>
            {crumbs.slice(0, -1).map((crumb) => (
              <li key={crumb.id} className="flex items-center gap-0.5">
                <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
                <Link
                  href={shareHref({ token, folderId: crumb.id })}
                  className="rounded-md px-1 text-muted hover:text-fg"
                >
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <h1 className="font-display truncate text-2xl font-semibold tracking-tight text-fg">
        {current}
      </h1>
    </div>
  );
}

function FolderShareCrumbs({
  token,
  rootFolderId,
  contents,
}: {
  token: string;
  rootFolderId: string;
  contents: FolderContents;
}) {
  const t = useT();
  const start = contents.breadcrumbs.findIndex((crumb) => crumb.id === rootFolderId);
  const crumbs =
    start >= 0 ? contents.breadcrumbs.slice(start) : contents.breadcrumbs;
  const rootName = crumbs[0]?.name ?? contents.folder?.name ?? t.common.folder;
  const rest = crumbs.slice(1);
  const atShareRoot = contents.folder?.id === rootFolderId;
  const current = atShareRoot ? rootName : (rest.at(-1)?.name ?? rootName);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {!atShareRoot ? (
        <nav aria-label={t.drive.breadcrumbs}>
          <ol className="flex flex-wrap items-center gap-0.5 text-sm">
            <li>
              <Link
                href={shareHref({ token, folderId: rootFolderId })}
                className="rounded-md px-1 text-muted hover:text-fg"
              >
                {rootName}
              </Link>
            </li>
            {rest.slice(0, -1).map((crumb) => (
              <li key={crumb.id} className="flex items-center gap-0.5">
                <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
                <Link
                  href={shareHref({ token, folderId: crumb.id })}
                  className="rounded-md px-1 text-muted hover:text-fg"
                >
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <h1 className="font-display truncate text-2xl font-semibold tracking-tight text-fg">
        {current}
      </h1>
    </div>
  );
}
