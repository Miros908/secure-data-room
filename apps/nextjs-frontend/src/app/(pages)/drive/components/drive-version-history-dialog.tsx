'use client';

import { FileVersionHistory } from '@/app/components/file-version-history';
import { useFileVersions } from '@/app/hooks/queries/use-file-versions';
import { Dialog } from '@/components/ui/dialog';
import { useT } from '@/app/lib/i18n/use-t';

type DriveVersionHistoryDialogProps = {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onOpenVersion: (versionId: string) => void;
};

export function DriveVersionHistoryDialog({
  fileId,
  fileName,
  onClose,
  onOpenVersion,
}: DriveVersionHistoryDialogProps) {
  const t = useT();
  const versionsQuery = useFileVersions(fileId);
  const versions = versionsQuery.data?.versions;
  const currentVersionId = versions?.[0]?.id;

  return (
    <Dialog title={fileName} subtitle={t.drive.versionHistory} onClose={onClose}>
      {versionsQuery.isPending ? (
        <p className="text-sm text-muted">{t.common.loading}</p>
      ) : versions && versions.length > 0 && currentVersionId ? (
        <div className="-mx-2 max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto rounded-lg border border-border">
          <FileVersionHistory
            versions={versions}
            currentVersionId={currentVersionId}
            onOpen={(versionId) => {
              onClose();
              onOpenVersion(versionId);
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted">{t.drive.versionsFailed}</p>
      )}
    </Dialog>
  );
}
