'use client';

import type { ShareSource } from '@sdr/shared/access';
import type { FolderContents } from '@sdr/shared/folders';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useRef,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FolderIcon,
  HistoryIcon,
  MoveIcon,
  OpenIcon,
  PdfIcon,
  PencilIcon,
  ShareIcon,
  TrashIcon,
} from '@/components/ui/icons';
import { ContextMenu, type MenuAction } from '@/components/ui/menu';
import { cx } from '@/lib/cx';
import type { DriveSortDir, DriveSortKey, DriveViewMode } from '@/store/drive-ui.store';
import { DriveAccessStatus } from './drive-access-status';
import { setFileDragData } from './drive-file-drag';
import { DriveFileDropTarget } from './drive-file-drop-target';
import { driveItemKey, formatBytes, formatDriveDate, formatVersionCount } from './drive-format';
import { DriveItemMenu } from './drive-item-menu';
import { driveHref } from './drive-location';
import { useT } from '@/app/lib/i18n/use-t';
import type { Messages } from '@/app/lib/i18n/en';
import { matchesDriveQuery, sortDriveEntries } from './drive-sort';

type FolderChild = FolderContents['folders'][number];
type FolderFileChild = FolderContents['files'][number];

const EMPTY_KEYS = new Set<string>();

function filePreviewHref(
  contents: FolderContents,
  myRoomId: string | undefined,
  fileId: string,
) {
  return driveHref({
    folderId: contents.folder?.id,
    dataRoomId: contents.dataRoomId,
    myRoomId,
    fileId,
  });
}

export type DriveListEntry =
  | { kind: 'folder'; item: FolderChild }
  | { kind: 'file'; item: FolderFileChild };

type DriveItemListProps = {
  contents: FolderContents;
  myRoomId?: string;
  query?: string;
  viewMode: DriveViewMode;
  sortKey: DriveSortKey;
  sortDir: DriveSortDir;
  selectedKeys: Set<string>;
  focusedKey: string | null;
  canWrite?: boolean;
  canShare?: boolean;
  onToggleSelect: (key: string, event: { shift: boolean; rangeKeys: string[] }) => void;
  onFocusKey: (key: string | null) => void;
  onOpenFile?: (file: { id: string; name: string }) => void;
  onRenameFolder?: (folder: { id: string; name: string }) => void;
  onDeleteFolder?: (folder: { id: string; name: string }) => void;
  onRenameFile?: (file: { id: string; name: string }) => void;
  onMoveFile?: (file: { id: string; name: string }) => void;
  onDropFileToFolder?: (fileId: string, folderId: string) => void;
  onDeleteFile?: (file: { id: string; name: string }) => void;
  onShareFolder?: (folder: { id: string; name: string }) => void;
  onShareFile?: (file: { id: string; name: string }) => void;
  onOpenInherited?: (source: ShareSource) => void;
  onVersionHistory?: (file: { id: string; name: string }) => void;
  onSort: (key: DriveSortKey) => void;
  contextMenu: { x: number; y: number; key: string } | null;
  onContextMenu: (value: { x: number; y: number; key: string } | null) => void;
};

export function DriveItemList({
  contents,
  myRoomId,
  query = '',
  viewMode,
  sortKey,
  sortDir,
  selectedKeys = EMPTY_KEYS,
  focusedKey,
  canWrite = false,
  canShare = false,
  onToggleSelect,
  onFocusKey,
  onOpenFile,
  onRenameFolder,
  onDeleteFolder,
  onRenameFile,
  onMoveFile,
  onDropFileToFolder,
  onDeleteFile,
  onShareFolder,
  onShareFile,
  onOpenInherited,
  onVersionHistory,
  onSort,
  contextMenu,
  onContextMenu,
}: DriveItemListProps) {
  const t = useT();
  const router = useRouter();
  const keys = selectedKeys instanceof Set ? selectedKeys : EMPTY_KEYS;

  const openEntry = (entry: DriveListEntry) => {
    if (entry.kind === 'file') {
      router.push(filePreviewHref(contents, myRoomId, entry.item.id), {
        scroll: false,
      });
      return;
    }
    router.push(
      driveHref({
        folderId: entry.item.id,
        dataRoomId: contents.dataRoomId,
        myRoomId,
      }),
    );
  };
  const folders = sortDriveEntries(
    contents.folders.filter((folder) => matchesDriveQuery(folder.name, query)),
    sortKey,
    sortDir,
  );
  const files = sortDriveEntries(
    contents.files.filter((file) => matchesDriveQuery(file.name, query)),
    sortKey,
    sortDir,
  );
  const entries: DriveListEntry[] = [
    ...folders.map((item) => ({ kind: 'folder' as const, item })),
    ...files.map((item) => ({ kind: 'file' as const, item })),
  ];
  const rangeKeys = entries.map((entry) => driveItemKey(entry.kind, entry.item.id));
  const rowClass = (key: string) =>
    keys.has(key) || focusedKey === key
      ? '[&>td]:bg-accent/10'
      : 'hover:[&>td]:bg-surface-muted';

  const contextEntry = contextMenu
    ? entries.find(
        (entry) => driveItemKey(entry.kind, entry.item.id) === contextMenu.key,
      )
    : null;

  if (viewMode === 'grid') {
    return (
      <>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <GridCard
              key={driveItemKey(entry.kind, entry.item.id)}
              entry={entry}
              contents={contents}
              myRoomId={myRoomId}
              selected={keys.has(driveItemKey(entry.kind, entry.item.id))}
              focused={focusedKey === driveItemKey(entry.kind, entry.item.id)}
              canWrite={canWrite}
              canShare={canShare}
              onToggleSelect={(event) =>
                onToggleSelect(driveItemKey(entry.kind, entry.item.id), {
                  shift: event.shiftKey,
                  rangeKeys,
                })
              }
              onFocus={() => onFocusKey(driveItemKey(entry.kind, entry.item.id))}
              onDropFileToFolder={onDropFileToFolder}
              onShareFolder={onShareFolder}
              onShareFile={onShareFile}
              onOpenInherited={onOpenInherited}
              onOpen={() => openEntry(entry)}
              onVersionHistory={onVersionHistory}
              onRename={
                canWrite
                  ? entry.kind === 'folder'
                    ? onRenameFolder
                      ? () => onRenameFolder(entry.item)
                      : undefined
                    : onRenameFile
                      ? () => onRenameFile(entry.item)
                      : undefined
                  : undefined
              }
              onMove={
                canWrite && entry.kind === 'file' && onMoveFile
                  ? () => onMoveFile(entry.item)
                  : undefined
              }
              onDelete={
                canWrite
                  ? entry.kind === 'folder'
                    ? onDeleteFolder
                      ? () => onDeleteFolder(entry.item)
                      : undefined
                    : onDeleteFile
                      ? () => onDeleteFile(entry.item)
                      : undefined
                  : undefined
              }
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  key: driveItemKey(entry.kind, entry.item.id),
                });
              }}
            />
          ))}
        </ul>
        {contextMenu && contextEntry ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={entryActions(t, contextEntry, {
              canWrite,
              canShare,
              onOpen: () => openEntry(contextEntry),
              onVersionHistory,
              onShareFolder,
              onShareFile,
              onRenameFolder,
              onRenameFile,
              onMoveFile,
              onDeleteFolder,
              onDeleteFile,
            })}
            onClose={() => onContextMenu(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="min-w-0">
      <table className="w-full border-separate border-spacing-x-0 border-spacing-y-1">
        <thead className="sticky top-0 z-10 bg-bg/95 text-xs font-normal text-muted backdrop-blur-sm">
          <tr className="hidden sm:table-row">
            <th className="min-w-0 px-3 py-2 text-left font-normal">
              <SortHeader
                label={t.drive.name}
                column="name"
                active={sortKey}
                dir={sortDir}
                align="left"
                onSort={onSort}
              />
            </th>
            <th className="hidden w-[1%] px-2 py-2 text-center font-normal whitespace-nowrap sm:table-cell">
              {t.drive.access}
            </th>
            <th className="hidden w-[1%] px-2 py-2 text-right font-normal whitespace-nowrap lg:table-cell">
              <SortHeader
                label={t.drive.date}
                column="date"
                active={sortKey}
                dir={sortDir}
                align="right"
                onSort={onSort}
              />
            </th>
            <th className="hidden w-[1%] px-2 py-2 text-right font-normal whitespace-nowrap lg:table-cell">
              <SortHeader
                label={t.drive.size}
                column="size"
                active={sortKey}
                dir={sortDir}
                align="right"
                onSort={onSort}
              />
            </th>
            <th className="w-10 px-2 py-2 font-normal">
              <span className="sr-only">{t.drive.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => {
            const key = driveItemKey('folder', folder.id);
            return (
              <DriveFileDropTarget
                key={folder.id}
                as="tr"
                enabled={Boolean(canWrite && onDropFileToFolder)}
                onDropFile={(fileId) => onDropFileToFolder?.(fileId, folder.id)}
                className={cx('group [&>td]:transition-colors', rowClass(key))}
                onClick={(event) =>
                  handleRowActivate(event, {
                    onFocus: () => onFocusKey(key),
                    onOpen: () => openEntry({ kind: 'folder', item: folder }),
                  })
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  onContextMenu({ x: event.clientX, y: event.clientY, key });
                }}
              >
                <td className="min-w-0 rounded-l-xl px-3 py-2">
                  <div className="relative flex min-w-0 items-center gap-3">
                    <RowSelectControl
                      selected={keys.has(key)}
                      canWrite={canWrite}
                      label={t.drive.selectItem(folder.name)}
                      onChange={(event) =>
                        onToggleSelect(key, {
                          shift: hasShift(event.nativeEvent),
                          rangeKeys,
                        })
                      }
                    />
                    <Link
                      href={driveHref({
                        folderId: folder.id,
                        dataRoomId: contents.dataRoomId,
                        myRoomId,
                      })}
                      className="flex min-w-0 items-center gap-3"
                      onFocus={() => onFocusKey(key)}
                    >
                      <span className={rowGlyphClass(canWrite, keys.has(key))}>
                        <FolderIcon className="h-5 w-5 text-folder" />
                      </span>
                      <span className="truncate text-sm font-medium text-fg" title={folder.name}>
                        {folder.name}
                      </span>
                    </Link>
                  </div>
                </td>
                <td className="hidden w-[1%] px-2 py-2 text-center sm:table-cell">
                  {canShare && onShareFolder ? (
                    <DriveAccessStatus
                      sharing={folder.sharing}
                      compact
                      onOpenDirect={() => onShareFolder(folder)}
                      onOpenInherited={onOpenInherited}
                    />
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </td>
                <td className="hidden w-[1%] px-2 py-2 text-right whitespace-nowrap lg:table-cell">
                  <time className="text-sm text-muted" dateTime={folder.createdAt}>
                    {formatDriveDate(folder.createdAt)}
                  </time>
                </td>
                <td className="hidden w-[1%] px-2 py-2 text-right text-sm text-muted whitespace-nowrap lg:table-cell">
                  —
                </td>
                <td className="w-10 rounded-r-xl px-2 py-2 text-right">
                  <DriveItemMenu
                    label={t.drive.folderActions}
                    onOpen={() => openEntry({ kind: 'folder', item: folder })}
                    onShare={onShareFolder ? () => onShareFolder(folder) : undefined}
                    onRename={
                      canWrite && onRenameFolder
                        ? () => onRenameFolder(folder)
                        : undefined
                    }
                    onDelete={
                      canWrite && onDeleteFolder
                        ? () => onDeleteFolder(folder)
                        : undefined
                    }
                  />
                </td>
              </DriveFileDropTarget>
            );
          })}

          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              contents={contents}
              myRoomId={myRoomId}
              canWrite={canWrite}
              canShare={canShare}
              selected={keys.has(driveItemKey('file', file.id))}
              focused={focusedKey === driveItemKey('file', file.id)}
              rangeKeys={rangeKeys}
              onToggleSelect={onToggleSelect}
              onFocusKey={onFocusKey}
              onOpenFile={onOpenFile}
              onRenameFile={onRenameFile}
              onMoveFile={onMoveFile}
              onDeleteFile={onDeleteFile}
              onShareFile={onShareFile}
              onOpenInherited={onOpenInherited}
              onVersionHistory={onVersionHistory}
              onContextMenu={onContextMenu}
            />
          ))}
        </tbody>
      </table>

      {contextMenu && contextEntry ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={entryActions(t, contextEntry, {
            canWrite,
            canShare,
            onOpen: () => openEntry(contextEntry),
            onVersionHistory,
            onShareFolder,
            onShareFile,
            onRenameFolder,
            onRenameFile,
            onMoveFile,
            onDeleteFolder,
            onDeleteFile,
          })}
          onClose={() => onContextMenu(null)}
        />
      ) : null}
    </div>
  );
}

function FileRow({
  file,
  contents,
  myRoomId,
  canWrite,
  canShare,
  selected,
  focused,
  rangeKeys,
  onToggleSelect,
  onFocusKey,
  onOpenFile,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  onShareFile,
  onOpenInherited,
  onVersionHistory,
  onContextMenu,
}: {
  file: FolderFileChild;
  contents: FolderContents;
  myRoomId?: string;
  canWrite: boolean;
  canShare: boolean;
  selected: boolean;
  focused: boolean;
  rangeKeys: string[];
  onToggleSelect: DriveItemListProps['onToggleSelect'];
  onFocusKey: (key: string | null) => void;
  onOpenFile?: (file: { id: string; name: string }) => void;
  onRenameFile?: (file: { id: string; name: string }) => void;
  onMoveFile?: (file: { id: string; name: string }) => void;
  onDeleteFile?: (file: { id: string; name: string }) => void;
  onShareFile?: (file: { id: string; name: string }) => void;
  onOpenInherited?: (source: ShareSource) => void;
  onVersionHistory?: (file: { id: string; name: string }) => void;
  onContextMenu: DriveItemListProps['onContextMenu'];
}) {
  const t = useT();
  const skipClickRef = useRef(false);
  const key = driveItemKey('file', file.id);

  return (
    <tr
      className={cx(
        'group [&>td]:transition-colors',
        selected || focused ? '[&>td]:bg-accent/10' : 'hover:[&>td]:bg-surface-muted',
      )}
      onClick={(event) => {
        if (skipClickRef.current) {
          skipClickRef.current = false;
          return;
        }
        handleRowActivate(event, {
          onFocus: () => onFocusKey(key),
          onOpen: () => onOpenFile?.(file),
        });
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu({ x: event.clientX, y: event.clientY, key });
      }}
    >
      <td className="min-w-0 rounded-l-xl px-3 py-2">
        <div className="relative flex min-w-0 items-center gap-3">
          <RowSelectControl
            selected={selected}
            canWrite={canWrite}
            label={t.drive.selectItem(file.name)}
            onChange={(event) =>
              onToggleSelect(key, {
                shift: hasShift(event.nativeEvent),
                rangeKeys,
              })
            }
          />
          <Link
            href={filePreviewHref(contents, myRoomId, file.id)}
            scroll={false}
            draggable={canWrite}
            onFocus={() => onFocusKey(key)}
            onDragStart={(event) => {
              if (!canWrite) {
                event.preventDefault();
                return;
              }
              skipClickRef.current = true;
              setFileDragData(event.dataTransfer, file.id);
            }}
            onDragEnd={() => {
              window.setTimeout(() => {
                skipClickRef.current = false;
              }, 0);
            }}
            onClick={(event) => {
              if (skipClickRef.current) {
                event.preventDefault();
                skipClickRef.current = false;
              }
            }}
            className="flex min-w-0 cursor-pointer items-center gap-3 text-left"
          >
            <span className={rowGlyphClass(canWrite, selected)}>
              <PdfIcon className="h-5 w-5" />
            </span>
            <span className="truncate text-sm text-fg" title={file.name}>
              {file.name}
            </span>
            {formatVersionCount(file.versionCount) ? (
              <span className="shrink-0 text-xs text-muted">
                {formatVersionCount(file.versionCount)}
              </span>
            ) : null}
          </Link>
        </div>
      </td>
      <td className="hidden w-[1%] px-2 py-2 text-center sm:table-cell">
        {canShare && onShareFile ? (
          <DriveAccessStatus
            sharing={file.sharing}
            compact
            onOpenDirect={() => onShareFile(file)}
            onOpenInherited={onOpenInherited}
          />
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </td>
      <td className="hidden w-[1%] px-2 py-2 text-right whitespace-nowrap lg:table-cell">
        <time className="text-sm text-muted" dateTime={file.createdAt}>
          {formatDriveDate(file.createdAt)}
        </time>
      </td>
      <td className="hidden w-[1%] px-2 py-2 text-right text-sm text-muted whitespace-nowrap lg:table-cell">
        {formatBytes(file.sizeBytes)}
      </td>
      <td className="w-10 rounded-r-xl px-2 py-2 text-right">
        <DriveItemMenu
          label={t.drive.fileActions}
          onOpen={() => onOpenFile?.(file)}
          onShare={onShareFile ? () => onShareFile(file) : undefined}
          onRename={
            canWrite && onRenameFile ? () => onRenameFile(file) : undefined
          }
          onMove={canWrite && onMoveFile ? () => onMoveFile(file) : undefined}
          onDelete={
            canWrite && onDeleteFile ? () => onDeleteFile(file) : undefined
          }
          onVersionHistory={
            file.versionCount > 1
              ? () => onVersionHistory?.(file)
              : undefined
          }
        />
      </td>
    </tr>
  );
}

function GridCard({
  entry,
  contents,
  myRoomId,
  selected,
  focused,
  canWrite,
  canShare,
  onToggleSelect,
  onFocus,
  onDropFileToFolder,
  onShareFolder,
  onShareFile,
  onOpenInherited,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onVersionHistory,
  onContextMenu,
}: {
  entry: DriveListEntry;
  contents: FolderContents;
  myRoomId?: string;
  selected: boolean;
  focused: boolean;
  canWrite: boolean;
  canShare: boolean;
  onToggleSelect: (event: { shiftKey: boolean }) => void;
  onFocus: () => void;
  onDropFileToFolder?: (fileId: string, folderId: string) => void;
  onShareFolder?: (folder: { id: string; name: string }) => void;
  onShareFile?: (file: { id: string; name: string }) => void;
  onOpenInherited?: (source: ShareSource) => void;
  onOpen: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onVersionHistory?: (file: { id: string; name: string }) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const t = useT();
  const skipClickRef = useRef(false);
  const canDrag = canWrite && entry.kind === 'file';

  const menu = (
    <div className="absolute top-1.5 right-1.5 z-10">
      <DriveItemMenu
        label={t.drive.itemActions(entry.kind)}
        onOpen={onOpen}
        onShare={
          canShare
            ? () =>
                entry.kind === 'folder'
                  ? onShareFolder?.(entry.item)
                  : onShareFile?.(entry.item)
            : undefined
        }
        onRename={canWrite ? onRename : undefined}
        onMove={canWrite ? onMove : undefined}
        onDelete={canWrite ? onDelete : undefined}
        onVersionHistory={
          entry.kind === 'file' && entry.item.versionCount > 1
            ? () => onVersionHistory?.(entry.item)
            : undefined
        }
      />
    </div>
  );

  const checkbox = canWrite ? (
    <div
      className={cx(
        'absolute top-1.5 left-1.5 z-10 rounded-md bg-surface/90 shadow-sm',
        checkboxVisibility(selected),
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={selected}
        aria-label={t.drive.selectItem(entry.item.name)}
        onChange={(event) =>
          onToggleSelect({
            shiftKey: hasShift(event.nativeEvent),
          })
        }
      />
    </div>
  ) : null;

  const name = (
    <span className="w-full truncate text-sm font-medium text-fg" title={entry.item.name}>
      {entry.item.name}
    </span>
  );
  const openClassName = 'flex w-full flex-1 flex-col items-center gap-3';
  const openControl =
    entry.kind === 'folder' ? (
      <Link
        href={driveHref({
          folderId: entry.item.id,
          dataRoomId: contents.dataRoomId,
          myRoomId,
        })}
        className={openClassName}
        onFocus={onFocus}
      >
        <FolderIcon className="h-10 w-10 text-folder" />
        {name}
      </Link>
    ) : (
      <Link
        href={filePreviewHref(contents, myRoomId, entry.item.id)}
        scroll={false}
        className={openClassName}
        onFocus={onFocus}
        onClick={(event) => {
          if (skipClickRef.current) {
            event.preventDefault();
            skipClickRef.current = false;
          }
        }}
      >
        <PdfIcon className="h-10 w-10" />
        {name}
        {formatVersionCount(entry.item.versionCount) ? (
          <span className="text-xs text-muted">
            {formatVersionCount(entry.item.versionCount)}
          </span>
        ) : null}
      </Link>
    );

  const card = (
    <div className="group relative">
      {checkbox}
      {menu}
      <div
        className={cx(
          'flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-surface px-3 pt-8 pb-5 text-center transition-colors',
          selected || focused ? 'border-accent bg-accent/10' : 'hover:bg-surface-muted',
        )}
        draggable={canDrag}
        onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
          if (!canDrag || entry.kind !== 'file') {
            event.preventDefault();
            return;
          }
          skipClickRef.current = true;
          setFileDragData(event.dataTransfer, entry.item.id);
        }}
        onDragEnd={() => {
          window.setTimeout(() => {
            skipClickRef.current = false;
          }, 0);
        }}
        onContextMenu={onContextMenu}
        onClick={(event) => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
          }
          handleRowActivate(event, {
            onFocus,
            onOpen,
          });
        }}
      >
        {openControl}
        {canShare ? (
          <DriveAccessStatus
            sharing={entry.item.sharing}
            compact
            onOpenDirect={() =>
              entry.kind === 'folder'
                ? onShareFolder?.(entry.item)
                : onShareFile?.(entry.item)
            }
            onOpenInherited={onOpenInherited}
          />
        ) : null}
      </div>
    </div>
  );

  if (entry.kind === 'folder') {
    return (
      <li>
        <DriveFileDropTarget
          enabled={Boolean(canWrite && onDropFileToFolder)}
          onDropFile={(fileId) => onDropFileToFolder?.(fileId, entry.item.id)}
        >
          {card}
        </DriveFileDropTarget>
      </li>
    );
  }

  return <li>{card}</li>;
}

function SortHeader({
  label,
  column,
  active,
  dir,
  align,
  onSort,
  staticLabel = false,
}: {
  label: string;
  column: DriveSortKey;
  active: DriveSortKey;
  dir: DriveSortDir;
  align: 'left' | 'right';
  onSort?: (key: DriveSortKey) => void;
  staticLabel?: boolean;
}) {
  const alignClass =
    align === 'right'
      ? 'w-full justify-end text-right'
      : 'w-full justify-start text-left';

  if (staticLabel || !onSort) {
    return (
      <span className={cx('flex whitespace-nowrap', alignClass)}>{label}</span>
    );
  }

  const isActive = active === column;
  return (
    <button
      type="button"
      role="columnheader"
      onClick={() => onSort(column)}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cx(
        'inline-flex whitespace-nowrap rounded-md py-0.5 hover:text-fg',
        alignClass,
        isActive ? 'text-fg' : '',
      )}
    >
      {label}
      {isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function entryActions(
  t: Messages,
  entry: DriveListEntry,
  handlers: {
    canWrite: boolean;
    canShare: boolean;
    onOpen: () => void;
    onVersionHistory?: (file: { id: string; name: string }) => void;
    onShareFolder?: (folder: { id: string; name: string }) => void;
    onShareFile?: (file: { id: string; name: string }) => void;
    onRenameFolder?: (folder: { id: string; name: string }) => void;
    onRenameFile?: (file: { id: string; name: string }) => void;
    onMoveFile?: (file: { id: string; name: string }) => void;
    onDeleteFolder?: (folder: { id: string; name: string }) => void;
    onDeleteFile?: (file: { id: string; name: string }) => void;
  },
): MenuAction[] {
  const item = entry.item;
  const actions: MenuAction[] = [
    {
      id: 'open',
      label: t.common.open,
      icon: <OpenIcon className="h-4 w-4" />,
      onSelect: handlers.onOpen,
    },
  ];
  if (entry.kind === 'file' && entry.item.versionCount > 1) {
    actions.push({
      id: 'versions',
      label: t.drive.versionHistory,
      icon: <HistoryIcon className="h-4 w-4" />,
      onSelect: () => handlers.onVersionHistory?.(entry.item),
    });
  }
  if (handlers.canShare) {
    actions.push({
      id: 'share',
      label: t.common.share,
      icon: <ShareIcon className="h-4 w-4" />,
      onSelect: () =>
        entry.kind === 'folder'
          ? handlers.onShareFolder?.(item)
          : handlers.onShareFile?.(item),
    });
  }
  if (handlers.canWrite) {
    actions.push({
      id: 'rename',
      label: t.common.rename,
      icon: <PencilIcon className="h-4 w-4" />,
      onSelect: () =>
        entry.kind === 'folder'
          ? handlers.onRenameFolder?.(item)
          : handlers.onRenameFile?.(item),
    });
    if (entry.kind === 'file') {
      actions.push({
        id: 'move',
        label: t.common.move,
        icon: <MoveIcon className="h-4 w-4" />,
        onSelect: () => handlers.onMoveFile?.(item),
      });
    }
    actions.push({
      id: 'delete',
      label: t.common.delete,
      icon: <TrashIcon className="h-4 w-4" />,
      tone: 'danger',
      onSelect: () =>
        entry.kind === 'folder'
          ? handlers.onDeleteFolder?.(item)
          : handlers.onDeleteFile?.(item),
    });
  }
  return actions;
}

function hasShift(event: Event): boolean {
  return 'shiftKey' in event && Boolean((event as { shiftKey: boolean }).shiftKey);
}

function isChromeTarget(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element &&
      target.closest('a, button, input, label, [role="menu"], [role="menuitem"]'),
  );
}

function handleRowActivate(
  event: { target: EventTarget | null },
  options: {
    onFocus: () => void;
    onOpen?: () => void;
  },
) {
  if (isChromeTarget(event.target)) {
    return;
  }
  options.onFocus();
  options.onOpen?.();
}

function RowSelectControl({
  selected,
  canWrite,
  label,
  onChange,
}: {
  selected: boolean;
  canWrite: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!canWrite) {
    return null;
  }

  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center sm:absolute sm:top-1/2 sm:left-0 sm:z-10 sm:-translate-y-1/2',
        checkboxVisibility(selected),
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox checked={selected} aria-label={label} onChange={onChange} />
    </span>
  );
}

function rowGlyphClass(canWrite: boolean, selected: boolean): string {
  return cx(
    'flex h-6 w-6 shrink-0 items-center justify-center transition-opacity',
    canWrite &&
      (selected
        ? 'max-sm:hidden sm:opacity-0'
        : 'sm:group-hover:opacity-0 sm:group-focus-within:opacity-0'),
  );
}

function checkboxVisibility(selected: boolean): string {
  return selected
    ? 'opacity-100'
    : 'opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100';
}
