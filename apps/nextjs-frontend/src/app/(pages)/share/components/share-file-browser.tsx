'use client';

import { useRouter } from 'next/navigation';
import { useFile } from '@/app/hooks/queries/use-file';
import { Button } from '@/components/ui/button';
import { goBackOrReplace } from '@/app/lib/history-back';
import { apiErrorMessage } from '@/lib/api-error-message';
import { liveFileNotFoundMessage } from '@/app/lib/live-access-copy';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { useT } from '@/app/lib/i18n/use-t';
import { ShareFileViewer } from './share-file-viewer';
import { ShareItemList } from './share-item-list';
import { ShareListSkeleton } from './share-loading';
import { shareHref } from './share-location';

type ShareFileBrowserProps = {
  fileId: string;
  token: string;
  preview?: boolean;
};

export function ShareFileBrowser({
  fileId,
  token,
  preview = false,
}: ShareFileBrowserProps) {
  const t = useT();
  const router = useRouter();
  const fileQuery = useFile(fileId, token);
  const file = fileQuery.data;
  const notice = useLiveNotice();

  if (preview) {
    return (
      <ShareFileViewer
        fileId={fileId}
        token={token}
        onBack={() => goBackOrReplace(router, shareHref({ token }))}
      />
    );
  }

  if (fileQuery.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(fileQuery.error, {
            forbidden: t.drive.noFileAccess,
            not_found:
              liveFileNotFoundMessage(notice) ?? t.drive.fileNotFound,
            unauthorized: t.sharePage.invalidLink,
          })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void fileQuery.refetch()}
        >
          {t.common.retry}
        </Button>
      </div>
    );
  }

  if (fileQuery.isPending || !file) {
    return <ShareListSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-fg">
        {t.sharePage.viewViaLink}
      </div>
      <ShareItemList
        token={token}
        contents={{
          folder: null,
          dataRoomId: file.dataRoomId,
          role: file.role,
          accessExpiresAt: file.accessExpiresAt,
          breadcrumbs: [],
          folders: [],
          files: [
            {
              id: file.id,
              name: file.name,
              createdAt: file.createdAt,
              sizeBytes: file.sizeBytes,
              mimeType: file.mimeType,
              versionCount: file.versionCount,
            },
          ],
        }}
      />
    </div>
  );
}
