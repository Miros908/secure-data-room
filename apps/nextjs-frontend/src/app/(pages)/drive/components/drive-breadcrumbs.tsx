'use client';

import type { FolderContents } from '@sdr/shared/folders';
import Link from 'next/link';
import { ChevronRightIcon } from '@/components/ui/icons';
import { DriveFileDropTarget } from './drive-file-drop-target';
import { driveHref } from './drive-location';
import { useT } from '@/app/lib/i18n/use-t';

type DriveBreadcrumbsProps = {
  contents: FolderContents;
  roomName: string;
  canOpenRoomRoot: boolean;
  myRoomId?: string;
  canDropFiles?: boolean;
  onDropFileToFolder?: (fileId: string, folderId: string | null) => void;
};

export function DriveBreadcrumbs({
  contents,
  roomName,
  canOpenRoomRoot,
  myRoomId,
  canDropFiles = false,
  onDropFileToFolder,
}: DriveBreadcrumbsProps) {
  const t = useT();
  const crumbs = contents.breadcrumbs;
  const dataRoomId = contents.dataRoomId;
  const atRoot = !contents.folder;
  const currentFolderId = contents.folder?.id ?? null;
  const canDropToRoot = canDropFiles && !atRoot && Boolean(onDropFileToFolder);
  const currentName = atRoot ? roomName : (crumbs.at(-1)?.name ?? roomName);
  const ancestors = atRoot
    ? []
    : [{ id: null as string | null, name: roomName }, ...crumbs.slice(0, -1)];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {ancestors.length > 0 ? (
        <nav aria-label={t.drive.breadcrumbs}>
          <ol className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
            {ancestors.map((crumb, index) => {
              const isRoot = crumb.id === null;
              const canDropHere =
                canDropFiles &&
                Boolean(onDropFileToFolder) &&
                crumb.id !== currentFolderId;

              return (
                <li key={crumb.id ?? 'root'} className="flex min-w-0 items-center gap-0.5">
                  {index > 0 ? (
                    <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                  ) : null}
                  <DriveFileDropTarget
                    enabled={isRoot ? canDropToRoot : canDropHere}
                    onDropFile={(fileId) =>
                      onDropFileToFolder?.(fileId, crumb.id)
                    }
                    className="inline-flex min-w-0"
                  >
                    {isRoot ? (
                      canOpenRoomRoot ? (
                        <Link
                          href={driveHref({ dataRoomId, myRoomId })}
                          className="max-w-40 truncate rounded-md px-1 text-muted transition-colors hover:text-fg"
                        >
                          {crumb.name}
                        </Link>
                      ) : (
                        <span className="max-w-40 truncate px-1 text-muted">
                          {crumb.name}
                        </span>
                      )
                    ) : (
                      <Link
                        href={driveHref({
                          folderId: crumb.id ?? undefined,
                          dataRoomId,
                          myRoomId,
                        })}
                        className="max-w-40 truncate rounded-md px-1 text-muted transition-colors hover:text-fg"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </DriveFileDropTarget>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <h1 className="font-display truncate text-2xl font-semibold tracking-tight text-fg">
        {currentName}
      </h1>
    </div>
  );
}
