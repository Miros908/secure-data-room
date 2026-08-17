'use client';

import type { ResolvePublicLinkResponse } from '@sdr/shared/access';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { displayRoomName } from '@/app/(pages)/drive/components/drive-copy';
import { SearchHitList } from '@/app/components/search-hit-list';
import { useDataRoom } from '@/app/hooks/queries/use-data-room';
import { useDriveSearch } from '@/app/hooks/queries/use-drive-search';
import { useFolderContents } from '@/app/hooks/queries/use-folder-contents';
import { useDebouncedValue } from '@/app/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { goBackOrReplace } from '@/app/lib/history-back';
import { apiErrorMessage } from '@/lib/api-error-message';
import { liveFolderNotFoundMessage } from '@/app/lib/live-access-copy';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { useT } from '@/app/lib/i18n/use-t';
import { ShareBreadcrumbs } from './share-breadcrumbs';
import { ShareFileViewer } from './share-file-viewer';
import { ShareItemList } from './share-item-list';
import { ShareListSkeleton } from './share-loading';
import { shareHref } from './share-location';

type ShareFolderBrowserProps = {
  token: string;
  link: ResolvePublicLinkResponse;
  folderId?: string;
  fileId?: string;
};

export function ShareFolderBrowser({
  token,
  link,
  folderId: folderIdFromUrl,
  fileId,
}: ShareFolderBrowserProps) {
  const t = useT();
  const router = useRouter();
  const notice = useLiveNotice();
  const [search, setSearch] = useState('');
  const searchQueryText = search.trim();
  const debouncedSearch = useDebouncedValue(searchQueryText, 300);
  const folderId =
    folderIdFromUrl ?? (link.type === 'folder' ? link.subjectId : undefined);
  const dataRoomId =
    link.type === 'data_room' && !folderIdFromUrl ? link.subjectId : undefined;
  const contentsQuery = useFolderContents({ folderId, dataRoomId, token });
  const searchQuery = useDriveSearch({
    q: debouncedSearch,
    dataRoomId: link.dataRoomId,
    token,
    enabled: searchQueryText.length > 0,
  });
  const roomQuery = useDataRoom({
    id: link.dataRoomId,
    token,
    enabled: link.type === 'data_room',
  });

  if (fileId) {
    return (
      <ShareFileViewer
        fileId={fileId}
        token={token}
        onBack={() =>
          goBackOrReplace(router, shareHref({ token, folderId: folderIdFromUrl }))
        }
      />
    );
  }

  if (contentsQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(contentsQuery.error, {
            forbidden: t.drive.noFolderAccess,
            not_found:
              liveFolderNotFoundMessage(notice) ?? t.drive.folderNotFound,
            unauthorized: t.sharePage.invalidLink,
          })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void contentsQuery.refetch()}
        >
          {t.common.retry}
        </Button>
      </div>
    );
  }

  if (contentsQuery.isPending || !contentsQuery.data) {
    return <ShareListSkeleton />;
  }

  const contents = contentsQuery.data;
  const roomName = displayRoomName(
    roomQuery.data?.name,
    link.type === 'data_room',
  );
  const searching = searchQueryText.length > 0;
  const searchItems =
    searchQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const searchPending =
    searching &&
    (searchQueryText !== debouncedSearch ||
      (searchQuery.isPending && !searchQuery.data));
  const searchFailed = searching && Boolean(searchQuery.error);
  const searchEmpty =
    searching && !searchPending && !searchFailed && searchItems.length === 0;
  const listingEmpty =
    contents.folders.length === 0 && contents.files.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-fg">
        {t.sharePage.viewViaLink}
      </div>
      <label className="relative max-w-xl">
        <span className="sr-only">{t.search.label}</span>
        <input
          id="share-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSearch('');
              event.currentTarget.blur();
            }
          }}
          placeholder={t.search.short}
          autoComplete="off"
          className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm text-fg outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <ShareBreadcrumbs
        token={token}
        roomName={roomName}
        canOpenRoomRoot={link.type === 'data_room'}
        rootFolderId={link.type === 'folder' ? link.subjectId : undefined}
        contents={contents}
      />

      {searching ? (
        searchEmpty ? (
          <div
            role="status"
            className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center"
          >
            <p className="font-display text-xl font-semibold text-fg">
              {t.empty.noResults}
            </p>
            <p className="max-w-sm text-sm text-muted">
              {t.empty.noResultsFor(searchQueryText)}
            </p>
          </div>
        ) : (
          <SearchHitList
            items={searchItems}
            isLoading={searchPending}
            errorMessage={
              searchQuery.error
                ? apiErrorMessage(searchQuery.error, {
                    forbidden: t.drive.noFolderAccess,
                    not_found: t.sharePage.invalidLink,
                    unauthorized: t.sharePage.invalidLink,
                  })
                : null
            }
            onRetry={() => void searchQuery.refetch()}
            folderHref={(hit) => shareHref({ token, folderId: hit.id })}
            fileHref={(hit) =>
              shareHref({
                token,
                folderId: hit.parentId ?? folderId,
                fileId: hit.id,
              })
            }
            hasMore={Boolean(searchQuery.hasNextPage)}
            onLoadMore={() => void searchQuery.fetchNextPage()}
            isLoadingMore={searchQuery.isFetchingNextPage}
          />
        )
      ) : listingEmpty ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center"
        >
          <p className="font-display text-xl font-semibold text-fg">
            {t.empty.folder}
          </p>
          <p className="max-w-xs text-sm text-muted">{t.empty.folderHintRead}</p>
        </div>
      ) : (
        <ShareItemList token={token} contents={contents} />
      )}
    </div>
  );
}
