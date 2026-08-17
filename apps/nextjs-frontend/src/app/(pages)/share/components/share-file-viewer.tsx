'use client';

import { useEffect } from 'react';
import { FileDownloadButton } from '@/app/components/file-download-button';
import {
  FilePreviousVersionNotice,
  FileVersionSelect,
  useSelectedFileVersion,
} from '@/app/components/file-version-select';
import { PdfFrame } from '@/app/components/pdf-frame';
import { PdfWatermark } from '@/app/components/pdf-watermark';
import { useFile } from '@/app/hooks/queries/use-file';
import { useMe } from '@/app/hooks/queries/use-me';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { useRecordFileView } from '@/app/hooks/use-record-file-view';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { apiErrorMessage } from '@/lib/api-error-message';
import { liveFileNotFoundMessage } from '@/app/lib/live-access-copy';
import { useT } from '@/app/lib/i18n/use-t';

type ShareFileViewerProps = {
  fileId: string;
  token: string;
  onBack?: () => void;
};

const REFRESH_BEFORE_EXPIRY_MS = 30 * 1000;

export function ShareFileViewer({
  fileId,
  token,
  onBack,
}: ShareFileViewerProps) {
  const t = useT();
  const {
    data: file,
    error,
    isPending,
    isFetching,
    refetch,
  } = useFile(fileId, token);
  const preview = useSelectedFileVersion(file, token);
  const me = useMe();
  const notice = useLiveNotice();
  useRecordFileView(file?.id, token);

  useEffect(() => {
    const expiresAt = preview.downloadUrlExpiresAt;
    if (!expiresAt || isFetching || preview.isVersionPending) {
      return;
    }

    const delay =
      new Date(expiresAt).getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS;

    if (delay <= 0) {
      void refetch();
      return;
    }

    const timer = window.setTimeout(() => {
      void refetch();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    preview.downloadUrlExpiresAt,
    preview.isVersionPending,
    isFetching,
    refetch,
  ]);

  return (
    <section
      aria-labelledby="share-file-title"
      className="flex min-h-0 flex-1 flex-col bg-viewer"
    >
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-white/10 bg-viewer-bar px-3 py-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-viewer-fg hover:bg-white/10"
            aria-label={t.common.back}
            onClick={onBack}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        ) : null}
        <h1
          id="share-file-title"
          className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-viewer-fg"
          title={file?.name}
        >
          {file?.name ?? t.common.document}
        </h1>
        {file ? (
          <FileVersionSelect
            file={file}
            token={token}
            selectedVersionId={preview.selectedVersionId}
            onSelect={preview.setSelectedVersionId}
          />
        ) : null}
        {file && preview.downloadUrl ? (
          <FileDownloadButton
            fileId={file.id}
            token={token}
            versionId={
              preview.selectedVersionId &&
              preview.selectedVersionId !== file.currentVersionId
                ? preview.selectedVersionId
                : undefined
            }
          />
        ) : null}
      </header>
      <FilePreviousVersionNotice
        visible={Boolean(file) && !preview.isCurrent}
        onShowCurrent={() =>
          file ? preview.setSelectedVersionId(file.currentVersionId) : undefined
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-viewer">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p role="alert" className="text-sm text-danger">
              {apiErrorMessage(error, {
                forbidden: t.drive.noFileAccess,
                not_found:
                  liveFileNotFoundMessage(notice) ?? t.drive.fileNotFound,
                unauthorized: t.sharePage.invalidLink,
              })}
            </p>
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              {t.common.retry}
            </Button>
          </div>
        ) : isPending || !file || !preview.downloadUrl ? (
          <div
            className="flex h-full items-center justify-center"
            aria-busy="true"
            aria-live="polite"
          >
            <p className="text-sm text-viewer-muted">{t.common.loading}</p>
          </div>
        ) : (
          <>
            <PdfFrame
              key={preview.downloadUrl}
              title={file.name}
              src={preview.downloadUrl}
              className="absolute inset-0 h-full w-full border-0 bg-viewer"
            />
            {file.role !== 'owner' ? (
              <PdfWatermark email={me.data?.email} ready={!me.isPending} />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
