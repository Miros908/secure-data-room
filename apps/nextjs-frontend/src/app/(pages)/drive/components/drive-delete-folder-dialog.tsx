'use client';

import { useState } from 'react';
import { useDeleteFolder } from '@/app/hooks/mutations/use-delete-folder';
import { useFolderContents } from '@/app/hooks/queries/use-folder-contents';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { Messages } from '@/app/lib/i18n/en';
import { useT } from '@/app/lib/i18n/use-t';

type DriveDeleteFolderDialogProps = {
  folderId: string;
  folderName: string;
  knownContents?: {
    folders: Array<{ id: string; name: string }>;
    files: Array<{ id: string; name: string }>;
  };
  onClose: () => void;
  onDeleted: (folderId: string) => void;
};

const PREVIEW_LIMIT = 6;

export function DriveDeleteFolderDialog({
  folderId,
  folderName,
  knownContents,
  onClose,
  onDeleted,
}: DriveDeleteFolderDialogProps) {
  const t = useT();
  const deleteFolder = useDeleteFolder();
  const [formError, setFormError] = useState<string | null>(null);
  const previewQuery = useFolderContents({
    folderId,
    enabled: !knownContents,
  });

  const preview = knownContents ?? previewQuery.data;
  const previewError = knownContents ? null : previewQuery.error;
  const previewLoading = !knownContents && previewQuery.isPending;

  const onConfirm = () => {
    setFormError(null);
    deleteFolder.mutate(folderId, {
      onSuccess: () => onDeleted(folderId),
      onError: (error) => setFormError(folderDeleteMessage(error, t)),
    });
  };

  return (
    <Dialog
      title={t.drive.deleteFolderTitle}
      onClose={onClose}
      closeDisabled={deleteFolder.isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg">{t.drive.deleteFolderBody(folderName)}</p>

        <DeletePreview
          isLoading={previewLoading}
          error={previewError}
          folders={preview?.folders ?? []}
          files={preview?.files ?? []}
        />

        {formError ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deleteFolder.isPending}
            onClick={onClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={deleteFolder.isPending}
            onClick={onConfirm}
          >
            {t.common.delete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DeletePreview({
  isLoading,
  error,
  folders,
  files,
}: {
  isLoading: boolean;
  error: ApiRequestError | null;
  folders: Array<{ id: string; name: string }>;
  files: Array<{ id: string; name: string }>;
}) {
  const t = useT();

  if (isLoading) {
    return <p className="text-sm text-muted">{t.common.loading}</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-muted">{t.drive.folderPreviewFailed}</p>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return <p className="text-sm text-muted">{t.drive.folderEmptyDot}</p>;
  }

  const items = [
    ...folders.map((folder) => ({ id: folder.id, name: folder.name })),
    ...files.map((file) => ({ id: file.id, name: file.name })),
  ];
  const visible = items.slice(0, PREVIEW_LIMIT);
  const rest = items.length - visible.length;
  const nestedNote =
    folders.length > 0 ? t.drive.nestedFoldersNote : '';

  return (
    <div className="rounded-md bg-surface-muted px-3 py-2 text-sm text-fg">
      <p>
        {t.drive.folderHas(
          t.drive.foldersCount(folders.length),
          t.drive.filesCount(files.length),
        )}
        {nestedNote}
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted">
        {visible.map((item) => (
          <li key={item.id} className="truncate" title={item.name}>
            {item.name}
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <p className="mt-1 text-muted">{t.drive.andMore(rest)}</p>
      ) : null}
    </div>
  );
}

function folderDeleteMessage(error: ApiRequestError, t: Messages): string {
  return apiErrorMessage(error, {
    forbidden: t.errors.cannotDeleteFolder,
    not_found: t.errors.folderAlreadyDeleted,
  });
}
