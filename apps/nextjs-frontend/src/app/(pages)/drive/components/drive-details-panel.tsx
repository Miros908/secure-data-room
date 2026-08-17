'use client';

import type { SharingSummary } from '@sdr/shared/access';
import { FileVersionHistory } from '@/app/components/file-version-history';
import { useFileVersions } from '@/app/hooks/queries/use-file-versions';
import { Button } from '@/components/ui/button';
import { CloseIcon, FolderIcon, PdfIcon, ShareIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { formatBytes, formatDriveDate } from './drive-format';
import { formatSharingStatus } from './drive-sharing-label';

export type DriveDetailsSubject =
  | {
      kind: 'folder';
      id: string;
      name: string;
      createdAt: string;
      sharing?: SharingSummary;
    }
  | {
      kind: 'file';
      id: string;
      name: string;
      createdAt: string;
      sizeBytes: number;
      versionCount?: number;
      currentVersionId?: string;
      sharing?: SharingSummary;
    }
  | {
      kind: 'room';
      id: string;
      name: string;
      sharing?: SharingSummary;
    };

type DriveDetailsPanelProps = {
  subject: DriveDetailsSubject;
  onClose: () => void;
  onShare?: () => void;
  onOpenVersion?: (fileId: string, versionId: string) => void;
};

export function DriveDetailsPanel({
  subject,
  onClose,
  onShare,
  onOpenVersion,
}: DriveDetailsPanelProps) {
  const t = useT();

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-surface">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            {t.drive.detailsTitle}
          </p>
          <h2 className="truncate font-display text-lg font-semibold text-fg" title={subject.name}>
            {subject.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.common.close}
          onClick={onClose}
        >
          <CloseIcon className="h-4 w-4" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
        <div className="flex items-center gap-3">
          {subject.kind === 'file' ? (
            <PdfIcon className="h-8 w-8" />
          ) : (
            <FolderIcon className="h-8 w-8 text-folder" />
          )}
          <p className="text-muted">
            {subject.kind === 'file'
              ? t.common.file
              : subject.kind === 'folder'
                ? t.common.folder
                : t.common.drive}
          </p>
        </div>
        {subject.kind === 'file' ? (
          <Row label={t.drive.size} value={formatBytes(subject.sizeBytes)} />
        ) : null}
        {subject.kind === 'file' && subject.versionCount && subject.versionCount > 1 ? (
          <FileVersionSection
            fileId={subject.id}
            currentVersionId={subject.currentVersionId}
            onOpenVersion={onOpenVersion}
          />
        ) : null}
        {'createdAt' in subject ? (
          <Row label={t.drive.created} value={formatDriveDate(subject.createdAt)} />
        ) : null}
        {subject.sharing ? (
          <Row label={t.drive.access} value={formatSharingStatus(subject.sharing)} />
        ) : null}
        {onShare ? (
          <Button type="button" variant="secondary" onClick={onShare}>
            <ShareIcon className="h-4 w-4" />
            {t.drive.share}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

function FileVersionSection({
  fileId,
  currentVersionId,
  onOpenVersion,
}: {
  fileId: string;
  currentVersionId?: string;
  onOpenVersion?: (fileId: string, versionId: string) => void;
}) {
  const t = useT();
  const versionsQuery = useFileVersions(fileId);
  const versions = versionsQuery.data?.versions;
  const selectedId = currentVersionId ?? versions?.[0]?.id;

  return (
    <div>
      <p className="text-xs text-muted">{t.drive.versionHistory}</p>
      {versionsQuery.isPending ? (
        <p className="mt-1 text-sm text-muted">{t.common.loading}</p>
      ) : versions && versions.length > 0 && selectedId ? (
        <div className="-mx-2 mt-1 rounded-lg border border-border">
          <FileVersionHistory
            versions={versions}
            currentVersionId={currentVersionId ?? selectedId}
            onOpen={(versionId) => onOpenVersion?.(fileId, versionId)}
          />
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">{t.drive.versionsFailed}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="break-words text-fg">{value}</p>
    </div>
  );
}
