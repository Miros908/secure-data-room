'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AccessCountdown } from '@/app/components/access-countdown';
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
import { useRedirectUnauthorized } from '@/app/hooks/use-redirect-unauthorized';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { useRecordFileView } from '@/app/hooks/use-record-file-view';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';
import { apiErrorMessage } from '@/lib/api-error-message';
import { liveFileNotFoundMessage } from '@/app/lib/live-access-copy';
import { useT } from '@/app/lib/i18n/use-t';
import { DriveItemMenu } from './drive-item-menu';

type DriveFileViewerProps = {
  fileId: string;
  onClose: () => void;
  layout?: 'modal' | 'page';
  initialVersionId?: string;
  onShare?: (file: { id: string; name: string }) => void;
  onRename?: (file: { id: string; name: string }) => void;
  onMove?: (file: { id: string; name: string; folderId: string | null }) => void;
  onDelete?: (file: { id: string; name: string }) => void;
};

const REFRESH_BEFORE_EXPIRY_MS = 30 * 1000;

export function DriveFileViewer({
  fileId,
  onClose,
  layout = 'modal',
  initialVersionId,
  onShare,
  onRename,
  onMove,
  onDelete,
}: DriveFileViewerProps) {
  const t = useT();
  const {
    data: file,
    error,
    isPending,
    isFetching,
    refetch,
  } = useFile(fileId);
  const preview = useSelectedFileVersion(file, undefined, initialVersionId);
  const me = useMe();
  const notice = useLiveNotice();
  useRedirectUnauthorized(error);
  useRecordFileView(file?.id);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (layout !== 'modal') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [layout]);

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

  const loadError = error && error.statusCode !== 401 ? error : null;
  const isModal = layout === 'modal';

  const panel = (
    <div
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="file-viewer-title"
      className="flex h-full min-h-0 flex-1 flex-col bg-viewer"
    >
      <header className="relative z-20 flex min-w-0 shrink-0 items-center gap-2 border-b border-white/10 bg-viewer-bar px-3 py-2">
        <h2
          id="file-viewer-title"
          className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-viewer-fg"
          title={file?.name}
        >
          {file?.name ?? t.common.document}
        </h2>
        {file?.role !== 'owner' && file?.accessExpiresAt ? (
          <AccessCountdown
            expiresAt={file.accessExpiresAt}
            onExpired={() => void refetch()}
            className="hidden text-xs text-viewer-muted sm:block"
          />
        ) : null}
        {file && onRename && onMove && onDelete ? (
          <DriveItemMenu
            label={t.drive.fileActions}
            className="text-viewer-fg hover:bg-white/10"
            onShare={
              onShare ? () => onShare({ id: file.id, name: file.name }) : undefined
            }
            onRename={() => onRename({ id: file.id, name: file.name })}
            onMove={() =>
              onMove({
                id: file.id,
                name: file.name,
                folderId: file.folderId,
              })
            }
            onDelete={() => onDelete({ id: file.id, name: file.name })}
          />
        ) : null}
        {file ? (
          <FileVersionSelect
            file={file}
            selectedVersionId={preview.selectedVersionId}
            onSelect={preview.setSelectedVersionId}
          />
        ) : null}
        {file && preview.downloadUrl ? (
          <FileDownloadButton
            fileId={file.id}
            versionId={
              preview.selectedVersionId &&
              preview.selectedVersionId !== file.currentVersionId
                ? preview.selectedVersionId
                : undefined
            }
          />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-viewer-fg hover:bg-white/10"
          aria-label={t.drive.closeViewer}
          onClick={onClose}
        >
          <CloseIcon className="h-4 w-4" />
        </Button>
      </header>
      <FilePreviousVersionNotice
        visible={Boolean(file) && !preview.isCurrent}
        onShowCurrent={() =>
          file ? preview.setSelectedVersionId(file.currentVersionId) : undefined
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-viewer">
        {loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p role="alert" className="text-sm text-danger">
              {apiErrorMessage(loadError, {
                forbidden: t.drive.noFileAccess,
                not_found:
                  liveFileNotFoundMessage(notice) ?? t.drive.fileNotFound,
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
              className="h-full w-full border-0 bg-viewer"
            />
            {file.role !== 'owner' ? (
              <PdfWatermark email={me.data?.email} ready={!me.isPending} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  if (!isModal) {
    return panel;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">{panel}</div>,
    document.body,
  );
}
