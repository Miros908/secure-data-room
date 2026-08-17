'use client';

import { useState } from 'react';
import { useDeleteFile } from '@/app/hooks/mutations/use-delete-file';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useT } from '@/app/lib/i18n/use-t';

type DriveDeleteFileDialogProps = {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onDeleted: (fileId: string) => void;
};

export function DriveDeleteFileDialog({
  fileId,
  fileName,
  onClose,
  onDeleted,
}: DriveDeleteFileDialogProps) {
  const t = useT();
  const deleteFile = useDeleteFile();
  const [formError, setFormError] = useState<string | null>(null);

  const onConfirm = () => {
    setFormError(null);
    deleteFile.mutate(fileId, {
      onSuccess: () => onDeleted(fileId),
      onError: (error) =>
        setFormError(
          apiErrorMessage(error, {
            forbidden: t.errors.cannotDeleteFile,
            not_found: t.errors.fileAlreadyDeleted,
          }),
        ),
    });
  };

  return (
    <Dialog
      title={t.drive.deleteFileTitle}
      onClose={onClose}
      closeDisabled={deleteFile.isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg">{t.drive.deleteFileBody(fileName)}</p>

        {formError ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deleteFile.isPending}
            onClick={onClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={deleteFile.isPending}
            onClick={onConfirm}
          >
            {t.common.delete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
