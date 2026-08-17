'use client';

import type {
  AccessSubjectType,
  EffectiveRoleDto,
  ShareSource,
} from '@sdr/shared/access';
import type { ListDataRoomsResponse } from '@sdr/shared/data-rooms';
import type { FolderContents } from '@sdr/shared/folders';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessCountdown } from '@/app/components/access-countdown';
import { useMoveFile } from '@/app/hooks/mutations/use-move-file';
import { useUploadFiles } from '@/app/hooks/mutations/use-upload-files';
import { Button } from '@/components/ui/button';
import {
  GridIcon,
  InfoIcon,
  ListIcon,
  ShareIcon,
} from '@/components/ui/icons';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { liveFolderNotFoundMessage } from '@/app/lib/live-access-copy';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { useDriveUiStore } from '@/store/drive-ui.store';
import { DriveAccessDialog } from './drive-access-panel';
import { DriveBreadcrumbs } from './drive-breadcrumbs';
import { DriveBulkDeleteDialog, type BulkDeleteItem } from './drive-bulk-delete-dialog';
import { DriveDeleteFileDialog } from './drive-delete-file-dialog';
import { DriveDeleteFolderDialog } from './drive-delete-folder-dialog';
import { DriveDetailsPanel, type DriveDetailsSubject } from './drive-details-panel';
import { displayRoomName } from './drive-copy';
import { DriveEmptyState } from './drive-empty-state';
import { DriveFileViewer } from './drive-file-viewer';
import { DriveFolderFormDialog } from './drive-folder-form-dialog';
import { driveItemKey, parseDriveItemKey } from './drive-format';
import { DriveItemList } from './drive-item-list';
import {
  canShareDrive,
  canWriteDrive,
  driveHref,
  type DriveAccessSubject,
} from './drive-location';
import { DriveMoveFileDialog } from './drive-move-file-dialog';
import { DriveRenameFileDialog } from './drive-rename-file-dialog';
import { inheritedLabel } from './drive-sharing-label';
import { sortDriveEntries } from './drive-sort';
import { SearchHitList } from '@/app/components/search-hit-list';
import { useDriveSearch } from '@/app/hooks/queries/use-drive-search';
import { useDebouncedValue } from '@/app/hooks/use-debounced-value';
import { DriveUploadQueue } from './drive-upload-queue';
import { DriveUploadZone } from './drive-upload-zone';
import { DriveVersionHistoryDialog } from './drive-version-history-dialog';
import { useT } from '@/app/lib/i18n/use-t';
import type { Messages } from '@/app/lib/i18n/en';

type DriveBrowserProps = {
  myRoomId?: string;
  rooms?: ListDataRoomsResponse;
  contents?: FolderContents;
  fileId?: string;
  isLoading: boolean;
  error: ApiRequestError | null;
  onRetry: () => void;
  access?: DriveAccessSubject;
  search: string;
  openCreate: boolean;
  openUpload: boolean;
  onCreateOpened: () => void;
  onUploadOpened: () => void;
};

type DriveDialog =
  | { type: 'create' }
  | { type: 'rename'; folderId: string; name: string }
  | { type: 'delete'; folderId: string; name: string }
  | { type: 'rename-file'; fileId: string; name: string }
  | { type: 'move-file'; fileId: string; name: string; folderId: string | null; fileIds?: string[] }
  | { type: 'delete-file'; fileId: string; name: string }
  | { type: 'versions'; fileId: string; name: string }
  | { type: 'bulk-delete'; items: BulkDeleteItem[] };

function listingHref(contents: FolderContents | undefined, myRoomId?: string) {
  if (!contents) {
    return '/drive';
  }

  return driveHref({
    folderId: contents.folder?.id,
    dataRoomId: contents.dataRoomId,
    myRoomId,
  });
}

function previewHref(
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

export function DriveBrowser({
  myRoomId,
  rooms,
  contents,
  fileId: fileIdFromUrl,
  isLoading,
  error,
  onRetry,
  access,
  search,
  openCreate,
  openUpload,
  onCreateOpened,
  onUploadOpened,
}: DriveBrowserProps) {
  const t = useT();
  const router = useRouter();
  const roleLabels: Record<EffectiveRoleDto, string> = {
    owner: t.common.owner,
    editor: t.common.editor,
    viewer: t.common.viewer,
  };
  const moveErrorOverrides = {
    name_taken: t.errors.fileNameTakenHere,
    invalid_destination: t.errors.invalid_destination,
    forbidden: t.errors.cannotMoveFile,
    not_found: t.errors.fileAlreadyDeleted,
  };
  const [dialog, setDialog] = useState<DriveDialog | null>(null);
  const [previewVersion, setPreviewVersion] = useState<{
    fileId: string;
    versionId: string;
  } | null>(null);
  const [previewScope, setPreviewScope] = useState(fileIdFromUrl ?? null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    key: string;
  } | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeViewer = useCallback(() => {
    setPreviewVersion(null);
    router.replace(listingHref(contents, myRoomId));
  }, [contents, myRoomId, router]);
  const openFile = useCallback(
    (id: string, versionId?: string) => {
      setPreviewVersion(versionId ? { fileId: id, versionId } : null);
      if (!contents || id === fileIdFromUrl) {
        return;
      }
      router.push(previewHref(contents, myRoomId, id), { scroll: false });
    },
    [contents, fileIdFromUrl, myRoomId, router],
  );
  const { items: uploads, uploadFiles, dismiss } = useUploadFiles();
  const moveFile = useMoveFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewMode = useDriveUiStore((state) => state.viewMode);
  const setViewMode = useDriveUiStore((state) => state.setViewMode);
  const sortKey = useDriveUiStore((state) => state.sortKey);
  const sortDir = useDriveUiStore((state) => state.sortDir);
  const setSort = useDriveUiStore((state) => state.setSort);
  const detailsOpen = useDriveUiStore((state) => state.detailsOpen);
  const toggleDetails = useDriveUiStore((state) => state.toggleDetails);
  const setDetailsOpen = useDriveUiStore((state) => state.setDetailsOpen);
  const notice = useLiveNotice();
  const searchQueryText = search.trim();
  const debouncedSearch = useDebouncedValue(searchQueryText, 300);
  const searchQuery = useDriveSearch({
    q: debouncedSearch,
    dataRoomId: contents?.dataRoomId,
    enabled: searchQueryText.length > 0 && Boolean(contents?.dataRoomId),
  });

  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const locationKey = `${contents?.dataRoomId ?? ''}:${contents?.folder?.id ?? ''}:${search}`;
  const [selectionScope, setSelectionScope] = useState(locationKey);
  if (selectionScope !== locationKey) {
    setSelectionScope(locationKey);
    setSelectedKeys(new Set());
    setFocusedKey(null);
    setAnchorKey(null);
  }

  const previewFileId = fileIdFromUrl ?? null;
  if (previewScope !== previewFileId) {
    setPreviewScope(previewFileId);
    if (!previewFileId) {
      setPreviewVersion(null);
    }
  }

  useEffect(() => {
    if (!openUpload) {
      return;
    }
    fileInputRef.current?.click();
    onUploadOpened();
  }, [openUpload, onUploadOpened]);

  const createOpen = openCreate || dialog?.type === 'create';
  const closeCreate = () => {
    closeDialog();
    onCreateOpened();
  };

  if (error && error.statusCode !== 401) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(error, {
            forbidden: t.drive.noFolderAccess,
            not_found:
              liveFolderNotFoundMessage(notice) ?? t.drive.folderNotFound,
          })}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="ghost" onClick={onRetry}>
            {t.common.retry}
          </Button>
          {error.statusCode === 404 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.replace('/drive')}
            >
              {t.nav.myDrive}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DriveListSkeleton />;
  }

  if (!contents) {
    return (
      <p role="status" className="px-6 py-20 text-center text-sm text-muted">
        {t.nav.openDriveFailed}
      </p>
    );
  }

  const roomName = resolveRoomName(contents.dataRoomId, rooms);
  const canOpenRoomRoot = canAccessRoomRoot(contents.dataRoomId, rooms);
  const canWrite = canWriteDrive(contents.role);
  const canShare = canShareDrive(contents.role);
  const currentFolder = contents.folder;
  const uploadTarget = {
    dataRoomId: contents.dataRoomId,
    folderId: currentFolder?.id,
  };

  const searching = searchQueryText.length > 0;
  const visibleFolders = searching
    ? []
    : sortDriveEntries(contents.folders, sortKey, sortDir);
  const visibleFiles = searching
    ? []
    : sortDriveEntries(contents.files, sortKey, sortDir);
  const listingEmpty =
    contents.folders.length === 0 && contents.files.length === 0;
  const searchItems =
    searchQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const searchPending =
    searching &&
    (searchQueryText !== debouncedSearch ||
      (searchQuery.isPending && !searchQuery.data));
  const searchFailed = searching && Boolean(searchQuery.error);
  const searchEmpty =
    searching && !searchPending && !searchFailed && searchItems.length === 0;
  const rangeKeys = [
    ...visibleFolders.map((folder) => driveItemKey('folder', folder.id)),
    ...visibleFiles.map((file) => driveItemKey('file', file.id)),
  ];

  const onDeletedFolder = (folderId: string) => {
    closeDialog();
    if (currentFolder?.id !== folderId) {
      return;
    }

    router.replace(
      driveHref({
        folderId: currentFolder.parentId ?? undefined,
        dataRoomId: contents.dataRoomId,
        myRoomId,
      }),
    );
  };

  const dropFileToFolder = (fileId: string, folderId: string | null) => {
    if (folderId === (currentFolder?.id ?? null)) {
      return;
    }

    setMoveError(null);
    moveFile.mutate(
      { id: fileId, folderId },
      {
        onError: (moveErr) =>
          setMoveError(apiErrorMessage(moveErr, moveErrorOverrides)),
      },
    );
  };

  const openAccess = (subject: { type: AccessSubjectType; id: string }) => {
    const href = driveHref({
      folderId: currentFolder?.id,
      dataRoomId: contents.dataRoomId,
      myRoomId,
      accessType: subject.type,
      accessId: subject.id,
    });
    if (fileIdFromUrl) {
      router.replace(href);
      return;
    }
    router.push(href);
  };

  const closeAccess = () => {
    router.push(
      driveHref({
        folderId: currentFolder?.id,
        dataRoomId: contents.dataRoomId,
        myRoomId,
      }),
    );
  };

  const openInheritedSource = (source: ShareSource) => {
    const href =
      source.type === 'folder'
        ? driveHref({
            folderId: source.id,
            dataRoomId: source.dataRoomId,
            myRoomId,
            accessType: 'folder',
            accessId: source.id,
          })
        : driveHref({
            dataRoomId: source.dataRoomId,
            myRoomId,
            accessType: 'data_room',
            accessId: source.id,
          });
    if (fileIdFromUrl) {
      router.replace(href);
      return;
    }
    router.push(href);
  };

  const toggleSelect = (
    key: string,
    event: { shift: boolean; rangeKeys: string[] },
  ) => {
    setFocusedKey(key);
    if (!canWrite) {
      return;
    }
    if (event.shift && anchorKey) {
      const start = event.rangeKeys.indexOf(anchorKey);
      const end = event.rangeKeys.indexOf(key);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelectedKeys(new Set(event.rangeKeys.slice(from, to + 1)));
        return;
      }
    }
    setAnchorKey(key);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectedItems: BulkDeleteItem[] = [...selectedKeys]
    .map((key) => {
      const parsed = parseDriveItemKey(key);
      if (!parsed) {
        return null;
      }
      if (parsed.kind === 'folder') {
        const folder = contents.folders.find((item) => item.id === parsed.id);
        return folder
          ? { kind: 'folder' as const, id: folder.id, name: folder.name }
          : null;
      }
      const file = contents.files.find((item) => item.id === parsed.id);
      return file ? { kind: 'file' as const, id: file.id, name: file.name } : null;
    })
    .filter((item): item is BulkDeleteItem => item !== null);

  const selectedFiles = selectedItems.filter((item) => item.kind === 'file');

  const detailsSubject: DriveDetailsSubject | null = (() => {
    if (selectedItems.length === 1) {
      const item = selectedItems[0];
      if (item.kind === 'folder') {
        const folder = contents.folders.find((entry) => entry.id === item.id);
        return folder
          ? {
              kind: 'folder',
              id: folder.id,
              name: folder.name,
              createdAt: folder.createdAt,
              sharing: folder.sharing,
            }
          : null;
      }
      const file = contents.files.find((entry) => entry.id === item.id);
      return file
        ? {
            kind: 'file',
            id: file.id,
            name: file.name,
            createdAt: file.createdAt,
            sizeBytes: file.sizeBytes,
            versionCount: file.versionCount,
            sharing: file.sharing,
          }
        : null;
    }
    if (currentFolder) {
      return {
        kind: 'folder',
        id: currentFolder.id,
        name: currentFolder.name,
        createdAt: currentFolder.createdAt,
        sharing: contents.sharing,
      };
    }
    return {
      kind: 'room',
      id: contents.dataRoomId,
      name: roomName,
      sharing: contents.sharing,
    };
  })();

  return (
    <div className="relative flex min-h-0 flex-1">
      <DriveKeyboard
        rangeKeys={rangeKeys}
        focusedKey={focusedKey}
        selectedKeys={selectedKeys}
        canWrite={canWrite && !searching}
        parentHref={
          currentFolder
            ? driveHref({
                folderId: currentFolder.parentId ?? undefined,
                dataRoomId: contents.dataRoomId,
                myRoomId,
              })
            : null
        }
        onFocusKey={setFocusedKey}
        onOpenFocused={() => {
          if (!focusedKey) {
            return;
          }
          const parsed = parseDriveItemKey(focusedKey);
          if (!parsed) {
            return;
          }
          if (parsed.kind === 'file') {
            openFile(parsed.id);
            return;
          }
          router.push(
            driveHref({
              folderId: parsed.id,
              dataRoomId: contents.dataRoomId,
              myRoomId,
            }),
          );
        }}
        onDelete={() => {
          if (selectedItems.length > 1) {
            setDialog({ type: 'bulk-delete', items: selectedItems });
            return;
          }
          if (selectedItems.length === 1) {
            const item = selectedItems[0];
            if (item.kind === 'file') {
              setDialog({
                type: 'delete-file',
                fileId: item.id,
                name: item.name,
              });
            } else {
              setDialog({ type: 'delete', folderId: item.id, name: item.name });
            }
          }
        }}
        onEscape={() => {
          setSelectedKeys(new Set());
          setContextMenu(null);
        }}
      />
      <DriveUploadZone
        enabled={canWrite && !searching}
        onFiles={(files) => void uploadFiles(files, uploadTarget)}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const list = event.target.files;
              if (list && list.length > 0) {
                void uploadFiles(Array.from(list), uploadTarget);
              }
              event.target.value = '';
            }}
          />

          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6">
            <div className="flex min-w-0 flex-col gap-1">
              <DriveBreadcrumbs
                contents={contents}
                roomName={roomName}
                canOpenRoomRoot={canOpenRoomRoot}
                myRoomId={myRoomId}
                canDropFiles={canWrite && !searching}
                onDropFileToFolder={dropFileToFolder}
              />
              {contents.role !== 'owner' ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted">{roleLabels[contents.role]}</p>
                  {contents.accessExpiresAt ? (
                    <AccessCountdown
                      expiresAt={contents.accessExpiresAt}
                      onExpired={() => onRetry()}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
              {canShare ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    openAccess({
                      type: currentFolder ? 'folder' : 'data_room',
                      id: currentFolder?.id ?? contents.dataRoomId,
                    })
                  }
                >
                  <ShareIcon className="h-4 w-4" />
                  {t.drive.share}
                </Button>
              ) : null}
              <Button
                type="button"
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t.drive.listView}
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t.drive.gridView}
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <GridIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={detailsOpen ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t.drive.details}
                aria-pressed={detailsOpen}
                onClick={toggleDetails}
              >
                <InfoIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {contents.sharing?.inheritedFrom ? (
            <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 sm:mx-6">
              <p className="text-sm text-fg">
                {t.drive.inheritedAccess(
                  inheritedLabel(
                    contents.sharing.inheritedFrom.type,
                    contents.sharing.inheritedFrom.name,
                  ),
                )}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openInheritedSource(contents.sharing!.inheritedFrom!)}
              >
                {t.common.manage}
              </Button>
            </div>
          ) : null}

          {canWrite && !searching && selectedItems.length > 0 ? (
            <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 sm:mx-6">
              <p className="mr-auto text-sm text-fg">
                {t.drive.selectedCount(selectedItems.length)}
              </p>
              {canWrite && selectedFiles.length === selectedItems.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialog({
                      type: 'move-file',
                      fileId: selectedFiles[0].id,
                      fileIds: selectedFiles.map((file) => file.id),
                      name: selectedFiles[0].name,
                      folderId: currentFolder?.id ?? null,
                    })
                  }
                >
                  {t.common.move}
                </Button>
              ) : null}
              {canShare && selectedItems.length === 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    openAccess({
                      type: selectedItems[0].kind === 'file' ? 'file' : 'folder',
                      id: selectedItems[0].id,
                    })
                  }
                >
                  {t.drive.share}
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialog({ type: 'bulk-delete', items: selectedItems })
                  }
                >
                  {t.common.delete}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedKeys(new Set())}
              >
                {t.drive.clearSelection}
              </Button>
            </div>
          ) : null}

          <div
            className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-20 sm:px-6 md:pb-4${
              detailsOpen ? ' lg:pr-[19.5rem]' : ''
            }`}
          >
            {searching ? (
              searchEmpty ? (
                <DriveEmptyState canWrite={false} query={searchQueryText} />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  {searchItems.length > 0 ? (
                    <p className="text-sm text-muted">{t.search.acrossRoom}</p>
                  ) : null}
                  <SearchHitList
                    items={searchItems}
                    isLoading={searchPending}
                    errorMessage={
                      searchQuery.error
                        ? apiErrorMessage(searchQuery.error, {
                            forbidden: t.drive.noFolderAccess,
                            not_found: t.drive.folderNotFound,
                          })
                        : null
                    }
                    onRetry={() => void searchQuery.refetch()}
                    folderHref={(hit) =>
                      driveHref({
                        folderId: hit.id,
                        dataRoomId: contents.dataRoomId,
                        myRoomId,
                      })
                    }
                    fileHref={(hit) =>
                      driveHref({
                        folderId: hit.parentId ?? undefined,
                        dataRoomId: contents.dataRoomId,
                        myRoomId,
                        fileId: hit.id,
                      })
                    }
                    hasMore={Boolean(searchQuery.hasNextPage)}
                    onLoadMore={() => void searchQuery.fetchNextPage()}
                    isLoadingMore={searchQuery.isFetchingNextPage}
                  />
                </div>
              )
            ) : listingEmpty ? (
              <DriveEmptyState
                canWrite={canWrite}
                onCreateFolder={() => setDialog({ type: 'create' })}
                onUpload={openPicker}
              />
            ) : (
              <DriveItemList
                contents={contents}
                myRoomId={myRoomId}
                query=""
                viewMode={viewMode}
                sortKey={sortKey}
                sortDir={sortDir}
                selectedKeys={selectedKeys}
                focusedKey={focusedKey}
                canWrite={canWrite}
                canShare={canShare}
                onToggleSelect={toggleSelect}
                onFocusKey={setFocusedKey}
                onSort={setSort}
                contextMenu={contextMenu}
                onContextMenu={setContextMenu}
                onOpenFile={(file) => openFile(file.id)}
                onVersionHistory={(file) =>
                  setDialog({
                    type: 'versions',
                    fileId: file.id,
                    name: file.name,
                  })
                }
                onRenameFolder={
                  canWrite
                    ? (folder) =>
                        setDialog({
                          type: 'rename',
                          folderId: folder.id,
                          name: folder.name,
                        })
                    : undefined
                }
                onDeleteFolder={
                  canWrite
                    ? (folder) =>
                        setDialog({
                          type: 'delete',
                          folderId: folder.id,
                          name: folder.name,
                        })
                    : undefined
                }
                onRenameFile={
                  canWrite
                    ? (file) =>
                        setDialog({
                          type: 'rename-file',
                          fileId: file.id,
                          name: file.name,
                        })
                    : undefined
                }
                onMoveFile={
                  canWrite
                    ? (file) =>
                        setDialog({
                          type: 'move-file',
                          fileId: file.id,
                          name: file.name,
                          folderId: currentFolder?.id ?? null,
                        })
                    : undefined
                }
                onDropFileToFolder={canWrite ? dropFileToFolder : undefined}
                onDeleteFile={
                  canWrite
                    ? (file) =>
                        setDialog({
                          type: 'delete-file',
                          fileId: file.id,
                          name: file.name,
                        })
                    : undefined
                }
                onShareFolder={
                  canShare
                    ? (folder) => openAccess({ type: 'folder', id: folder.id })
                    : undefined
                }
                onShareFile={
                  canShare
                    ? (file) => openAccess({ type: 'file', id: file.id })
                    : undefined
                }
                onOpenInherited={openInheritedSource}
              />
            )}

            {moveError ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {moveError}
              </p>
            ) : null}
          </div>
        </div>
      </DriveUploadZone>

      {detailsOpen && detailsSubject ? (
        <div className="absolute inset-y-0 right-0 z-20 hidden w-72 lg:block">
          <DriveDetailsPanel
            subject={detailsSubject}
            onClose={() => setDetailsOpen(false)}
            onOpenVersion={openFile}
            onShare={
              canShare
                ? () =>
                    openAccess({
                      type:
                        detailsSubject.kind === 'file'
                          ? 'file'
                          : detailsSubject.kind === 'folder'
                            ? 'folder'
                            : 'data_room',
                      id: detailsSubject.id,
                    })
                : undefined
            }
          />
        </div>
      ) : null}

      <DriveUploadQueue items={uploads} onDismiss={dismiss} />

      {createOpen ? (
        <DriveFolderFormDialog
          mode="create"
          dataRoomId={contents.dataRoomId}
          parentId={currentFolder?.id}
          onClose={closeCreate}
        />
      ) : null}

      {dialog?.type === 'rename' ? (
        <DriveFolderFormDialog
          mode="rename"
          dataRoomId={contents.dataRoomId}
          folderId={dialog.folderId}
          initialName={dialog.name}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'delete' ? (
        <DriveDeleteFolderDialog
          folderId={dialog.folderId}
          folderName={dialog.name}
          knownContents={
            currentFolder?.id === dialog.folderId ? contents : undefined
          }
          onClose={closeDialog}
          onDeleted={onDeletedFolder}
        />
      ) : null}

      {dialog?.type === 'rename-file' ? (
        <DriveRenameFileDialog
          fileId={dialog.fileId}
          initialName={dialog.name}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'move-file' ? (
        <DriveMoveFileDialog
          fileId={dialog.fileId}
          fileIds={dialog.fileIds}
          fileName={dialog.name}
          dataRoomId={contents.dataRoomId}
          rootName={roomName}
          currentFolderId={dialog.folderId}
          onClose={closeDialog}
        />
      ) : null}

      {dialog?.type === 'delete-file' ? (
        <DriveDeleteFileDialog
          fileId={dialog.fileId}
          fileName={dialog.name}
          onClose={closeDialog}
          onDeleted={(fileId) => {
            closeDialog();
            if (fileIdFromUrl === fileId) {
              closeViewer();
            }
          }}
        />
      ) : null}

      {dialog?.type === 'versions' ? (
        <DriveVersionHistoryDialog
          fileId={dialog.fileId}
          fileName={dialog.name}
          onClose={closeDialog}
          onOpenVersion={(versionId) => openFile(dialog.fileId, versionId)}
        />
      ) : null}

      {dialog?.type === 'bulk-delete' ? (
        <DriveBulkDeleteDialog
          items={dialog.items}
          onClose={closeDialog}
          onDeleted={() => {
            closeDialog();
            setSelectedKeys(new Set());
          }}
        />
      ) : null}

      {fileIdFromUrl ? (
        <DriveFileViewer
          key={`${fileIdFromUrl}:${
            previewVersion?.fileId === fileIdFromUrl
              ? previewVersion.versionId
              : ''
          }`}
          fileId={fileIdFromUrl}
          initialVersionId={
            previewVersion?.fileId === fileIdFromUrl
              ? previewVersion.versionId
              : undefined
          }
          onClose={closeViewer}
          onRename={
            canWrite
              ? (file) =>
                  setDialog({
                    type: 'rename-file',
                    fileId: file.id,
                    name: file.name,
                  })
              : undefined
          }
          onMove={
            canWrite
              ? (file) =>
                  setDialog({
                    type: 'move-file',
                    fileId: file.id,
                    name: file.name,
                    folderId: file.folderId,
                  })
              : undefined
          }
          onDelete={
            canWrite
              ? (file) =>
                  setDialog({
                    type: 'delete-file',
                    fileId: file.id,
                    name: file.name,
                  })
              : undefined
          }
          onShare={
            canShare
              ? (file) => openAccess({ type: 'file', id: file.id })
              : undefined
          }
        />
      ) : null}

      {access ? (
        <DriveAccessDialog
          type={access.type}
          id={access.id}
          name={resolveAccessName(access, contents, roomName, t)}
          onClose={closeAccess}
          onOpenSource={openInheritedSource}
        />
      ) : null}
    </div>
  );
}

function DriveKeyboard({
  rangeKeys,
  focusedKey,
  selectedKeys,
  canWrite,
  parentHref,
  onFocusKey,
  onOpenFocused,
  onDelete,
  onEscape,
}: {
  rangeKeys: string[];
  focusedKey: string | null;
  selectedKeys: Set<string>;
  canWrite: boolean;
  parentHref: string | null;
  onFocusKey: (key: string) => void;
  onOpenFocused: () => void;
  onDelete: () => void;
  onEscape: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      if (document.querySelector('[role="dialog"], [role="menu"]')) {
        return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        document.getElementById('drive-search')?.focus();
        return;
      }

      if (event.key === 'Escape') {
        onEscape();
        return;
      }

      if (event.key === 'Backspace' && parentHref && selectedKeys.size === 0) {
        event.preventDefault();
        router.push(parentHref);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && canWrite && selectedKeys.size > 0) {
        event.preventDefault();
        onDelete();
        return;
      }

      if (event.key === 'Enter' && focusedKey) {
        event.preventDefault();
        onOpenFocused();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      event.preventDefault();
      if (rangeKeys.length === 0) {
        return;
      }

      const current = focusedKey ? rangeKeys.indexOf(focusedKey) : -1;
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(rangeKeys.length - 1, current + 1)
          : Math.max(0, current === -1 ? 0 : current - 1);
      const next = rangeKeys[nextIndex];
      onFocusKey(next);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    canWrite,
    focusedKey,
    onDelete,
    onEscape,
    onFocusKey,
    onOpenFocused,
    parentHref,
    rangeKeys,
    router,
    selectedKeys,
  ]);

  return null;
}

function resolveAccessName(
  access: DriveAccessSubject | undefined,
  contents: FolderContents,
  roomName: string,
  t: Messages,
): string {
  if (!access) {
    return t.common.file;
  }

  if (access.type === 'data_room') {
    return roomName;
  }

  if (access.type === 'folder') {
    if (contents.folder?.id === access.id) {
      return contents.folder.name;
    }

    return (
      contents.folders.find((folder) => folder.id === access.id)?.name ??
        t.common.folder
    );
  }

  return contents.files.find((file) => file.id === access.id)?.name ?? t.common.file;
}

function resolveRoomName(
  dataRoomId: string,
  rooms?: ListDataRoomsResponse,
): string {
  if (rooms?.myRoom?.id === dataRoomId) {
    return displayRoomName(rooms.myRoom.name, true);
  }

  const shared = rooms?.sharedRooms.find((room) => room.id === dataRoomId);
  return displayRoomName(shared?.name);
}

function canAccessRoomRoot(
  dataRoomId: string,
  rooms?: ListDataRoomsResponse,
): boolean {
  if (rooms?.myRoom?.id === dataRoomId) {
    return true;
  }

  return Boolean(rooms?.sharedRooms.some((room) => room.id === dataRoomId));
}

function DriveListSkeleton() {
  const t = useT();

  return (
    <div className="space-y-2 p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="hidden grid-cols-[minmax(0,1fr)_4.75rem_7.5rem_5.25rem] gap-3 pt-4 sm:grid">
        <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-12 animate-pulse rounded bg-surface-muted justify-self-end" />
        <div className="h-3 w-14 animate-pulse rounded bg-surface-muted justify-self-end" />
        <div className="h-3 w-10 animate-pulse rounded bg-surface-muted justify-self-end" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-surface-muted" />
      </div>
      <span className="sr-only">{t.drive.loadingContents}</span>
    </div>
  );
}
