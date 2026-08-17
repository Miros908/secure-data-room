'use client';

import type { AuthUser } from '@sdr/shared/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDataRooms } from '@/app/hooks/queries/use-data-rooms';
import { useFile } from '@/app/hooks/queries/use-file';
import { useFolderContents } from '@/app/hooks/queries/use-folder-contents';
import { LiveAccessGate } from '@/app/hooks/use-live-access';
import { useRedirectUnauthorized } from '@/app/hooks/use-redirect-unauthorized';
import { Button } from '@/components/ui/button';
import { useT } from '@/app/lib/i18n/use-t';
import { goBackOrReplace } from '@/app/lib/history-back';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useDriveUiStore } from '@/store/drive-ui.store';
import { DriveActivityView } from './drive-activity-view';
import { DriveBrowser } from './drive-browser';
import { DriveCreateMenu } from './drive-create-menu';
import { DriveFileViewer } from './drive-file-viewer';
import { DriveHeader } from './drive-header';
import { DriveIncomingView } from './drive-incoming-view';
import {
  canWriteDrive,
  driveHref,
  driveOpenInFolderHref,
  isDriveSectionView,
  type DriveAccessSubject,
  type DriveView,
} from './drive-location';
import { DriveOutgoingView } from './drive-outgoing-view';
import { DriveSidebar } from './drive-sidebar';

type DriveShellProps = {
  user: AuthUser;
  folderId?: string;
  dataRoomId?: string;
  fileId?: string;
  view?: DriveView;
  access?: DriveAccessSubject;
};

export function DriveShell({
  user,
  folderId,
  dataRoomId: dataRoomIdFromUrl,
  fileId,
  view = 'folder',
  access,
}: DriveShellProps) {
  const t = useT();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const sidebarCollapsed = useDriveUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useDriveUiStore((state) => state.toggleSidebar);
  const roomsQuery = useDataRooms();
  const myRoomId = roomsQuery.data?.myRoom?.id;
  const rootDataRoomId = dataRoomIdFromUrl ?? myRoomId;
  const fileOnly = Boolean(fileId && !folderId);
  const sectionView = isDriveSectionView(view);
  const fileQuery = useFile(fileOnly ? fileId : undefined);
  const contentsQuery = useFolderContents({
    folderId,
    dataRoomId: folderId ? undefined : rootDataRoomId,
    enabled: !fileOnly && !sectionView,
  });

  useRedirectUnauthorized(roomsQuery.error);
  useRedirectUnauthorized(sectionView ? undefined : contentsQuery.error);

  const activeRoomId = fileOnly
    ? (fileQuery.data?.dataRoomId ?? rootDataRoomId)
    : (contentsQuery.data?.dataRoomId ??
      fileQuery.data?.dataRoomId ??
      rootDataRoomId);
  const waitingForRoom = !folderId && !rootDataRoomId && roomsQuery.isPending;
  const roomsError =
    roomsQuery.error && roomsQuery.error.statusCode !== 401
      ? roomsQuery.error
      : null;
  const canCreate = sectionView
    ? Boolean(roomsQuery.data?.myRoom)
    : canWriteDrive(contentsQuery.data?.role ?? 'viewer');

  const navKey = `${folderId ?? ''}:${dataRoomIdFromUrl ?? ''}:${view}:${fileId ?? ''}`;
  const [navScope, setNavScope] = useState(navKey);
  if (navScope !== navKey) {
    setNavScope(navKey);
    setMobileNav(false);
  }

  const searchKey = `${folderId ?? ''}:${dataRoomIdFromUrl ?? ''}:${view}`;
  const [searchScope, setSearchScope] = useState(searchKey);
  if (searchScope !== searchKey) {
    setSearchScope(searchKey);
    setSearch('');
  }

  const requestCreate = () => {
    if (sectionView) {
      router.push('/drive');
    }
    setOpenCreate(true);
  };

  const requestUpload = () => {
    if (sectionView) {
      router.push('/drive');
    }
    setOpenUpload(true);
  };

  return (
    <LiveAccessGate
      dataRoomId={sectionView ? myRoomId : activeRoomId}
      folderId={sectionView ? undefined : folderId}
      fileId={sectionView ? undefined : fileId}
    >
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <DriveHeader
        user={user}
        search={search}
        searchPlaceholder={sectionView ? t.search.short : t.search.drive}
        onSearchChange={setSearch}
        onToggleMobileNav={() => setMobileNav((current) => !current)}
        onToggleSidebar={toggleSidebar}
      />

      <div className="flex min-h-0 flex-1">
        <DriveSidebar
          rooms={roomsQuery.data}
          isLoading={roomsQuery.isPending}
          hasError={Boolean(roomsError)}
          activeRoomId={sectionView ? undefined : activeRoomId}
          myRoomId={myRoomId}
          view={view}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNav}
          canCreate={canCreate}
          onCloseMobile={() => setMobileNav(false)}
          onCreateFolder={requestCreate}
          onUpload={requestUpload}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === 'outgoing' ? (
            <DriveOutgoingView
              myRoomId={myRoomId}
              access={access}
              search={search}
              onOpenAccess={(subject) =>
                router.push(
                  driveHref({
                    view: 'outgoing',
                    accessType: subject.type,
                    accessId: subject.id,
                  }),
                )
              }
              onCloseAccess={() => router.push(driveHref({ view: 'outgoing' }))}
              onOpenSource={(source) =>
                router.push(
                  driveOpenInFolderHref({
                    type: source.type,
                    id: source.id,
                    dataRoomId: source.dataRoomId,
                    parentFolderId: null,
                    myRoomId,
                  }),
                )
              }
            />
          ) : view === 'incoming' ? (
            <DriveIncomingView myRoomId={myRoomId} search={search} />
          ) : view === 'activity' ? (
            <DriveActivityView roomId={myRoomId} search={search} />
          ) : fileOnly && fileId ? (
            <DriveFileViewer
              fileId={fileId}
              layout="page"
              onClose={() =>
                goBackOrReplace(
                  router,
                  driveHref({
                    folderId: fileQuery.data?.folderId ?? undefined,
                    dataRoomId:
                      fileQuery.data?.dataRoomId ?? dataRoomIdFromUrl,
                    myRoomId,
                  }),
                )
              }
            />
          ) : roomsError && !folderId ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <p role="alert" className="text-sm text-danger">
                {apiErrorMessage(roomsError)}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => roomsQuery.refetch()}
              >
                {t.common.retry}
              </Button>
            </div>
          ) : (
            <DriveBrowser
              myRoomId={myRoomId}
              rooms={roomsQuery.data}
              contents={contentsQuery.data}
              isLoading={
                !(roomsQuery.isSuccess && !folderId && !rootDataRoomId) &&
                (contentsQuery.isPending || waitingForRoom)
              }
              error={contentsQuery.error}
              onRetry={() => contentsQuery.refetch()}
              fileId={fileId}
              access={access}
              search={search}
              openCreate={openCreate}
              openUpload={openUpload}
              onCreateOpened={() => setOpenCreate(false)}
              onUploadOpened={() => setOpenUpload(false)}
            />
          )}
        </main>
      </div>

      {canCreate && !mobileNav && !fileOnly ? (
        <div className="fixed right-4 bottom-4 z-30 md:hidden">
          <DriveCreateMenu
            onCreateFolder={requestCreate}
            onUpload={requestUpload}
          />
        </div>
      ) : null}
    </div>
    </LiveAccessGate>
  );
}
