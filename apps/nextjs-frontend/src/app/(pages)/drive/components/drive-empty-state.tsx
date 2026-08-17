'use client';

import { useT } from '@/app/lib/i18n/use-t';
import { Button } from '@/components/ui/button';
import { FolderPlusIcon, UploadIcon } from '@/components/ui/icons';

type DriveEmptyStateProps = {
  canWrite?: boolean;
  query?: string;
  onCreateFolder?: () => void;
  onUpload?: () => void;
};

export function DriveEmptyState({
  canWrite = false,
  query,
  onCreateFolder,
  onUpload,
}: DriveEmptyStateProps) {
  const t = useT();

  if (query?.trim()) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center"
      >
        <p className="font-display text-xl font-semibold text-fg">
          {t.empty.noResults}
        </p>
        <p className="max-w-sm text-sm text-muted">
          {t.empty.noResultsFor(query.trim())}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center"
    >
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-folder/15 text-folder"
      >
        <EmptyFolderMark />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-semibold text-fg">{t.empty.folder}</p>
        <p className="max-w-sm text-sm text-muted">
          {canWrite ? t.empty.folderHintWrite : t.empty.folderHintRead}
        </p>
      </div>
      {canWrite ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onUpload ? (
            <Button type="button" variant="secondary" onClick={onUpload}>
              <UploadIcon className="h-4 w-4" />
              {t.drive.uploadPdf}
            </Button>
          ) : null}
          {onCreateFolder ? (
            <Button type="button" variant="ghost" onClick={onCreateFolder}>
              <FolderPlusIcon className="h-4 w-4" />
              {t.drive.newFolder}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyFolderMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
      <path d="M3.7 6.2A1.7 1.7 0 0 1 5.4 4.5h3.6c.32 0 .63.13.86.36l1.2 1.24h7.5A1.7 1.7 0 0 1 20.3 7.8v9.5a1.7 1.7 0 0 1-1.7 1.7H5.4a1.7 1.7 0 0 1-1.7-1.7z" />
    </svg>
  );
}
