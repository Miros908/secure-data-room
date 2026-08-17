'use client';

import { useSearchParams } from 'next/navigation';
import { useMe } from '@/app/hooks/queries/use-me';
import { usePublicLink } from '@/app/hooks/queries/use-public-link';
import { LiveAccessGate } from '@/app/hooks/use-live-access';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useT } from '@/app/lib/i18n/use-t';
import { ShareFileBrowser } from './share-file-browser';
import { ShareFolderBrowser } from './share-folder-browser';
import { ShareHeader } from './share-header';
import { ShareListSkeleton } from './share-loading';
import { parseShareToken, parseUuid } from './share-location';

export function ShareScreen() {
  const searchParams = useSearchParams();
  const token = parseShareToken(searchParams.get('token'));
  const folderId = parseUuid(searchParams.get('folderId'));
  const fileId = parseUuid(searchParams.get('fileId'));
  const me = useMe();
  const linkQuery = usePublicLink(token);
  const t = useT();

  return (
    <LiveAccessGate token={token} dataRoomId={linkQuery.data?.dataRoomId}>
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <ShareHeader
        user={me.data ?? null}
        isUserPending={me.isPending}
        accessExpiresAt={
          linkQuery.isSuccess ? linkQuery.data.accessExpiresAt : undefined
        }
        onAccessExpired={() => void linkQuery.refetch()}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!token ? (
          <ShareUnavailable />
        ) : linkQuery.isPending ? (
          <ShareListSkeleton />
        ) : linkQuery.error || !linkQuery.data ? (
          <ShareUnavailable
            message={
              linkQuery.error
                ? apiErrorMessage(linkQuery.error, {
                    not_found: t.sharePage.invalidOrExpired,
                    forbidden: t.sharePage.noLinkAccess,
                    unauthorized: t.sharePage.invalidLink,
                  })
                : undefined
            }
            onRetry={() => void linkQuery.refetch()}
          />
        ) : linkQuery.data.type === 'file' ? (
          <ShareFileBrowser
            fileId={linkQuery.data.subjectId}
            token={token}
            preview={fileId === linkQuery.data.subjectId}
          />
        ) : (
          <ShareFolderBrowser
            token={token}
            link={linkQuery.data}
            folderId={folderId}
            fileId={fileId}
          />
        )}
      </main>
    </div>
    </LiveAccessGate>
  );
}

function ShareUnavailable({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <p className="text-sm font-medium text-fg">{t.sharePage.unavailable}</p>
      <p role="alert" className="max-w-sm text-sm text-muted">
        {message ?? t.sharePage.checkLink}
      </p>
      {onRetry ? (
        <Button type="button" variant="ghost" onClick={onRetry}>
          {t.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
