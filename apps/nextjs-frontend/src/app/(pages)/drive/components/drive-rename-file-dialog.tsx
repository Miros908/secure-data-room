'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { renameFileSchema, type RenameFileDto } from '@sdr/shared/files';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRenameFile } from '@/app/hooks/mutations/use-rename-file';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { apiErrorMessage } from '@/lib/api-error-message';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { useT } from '@/app/lib/i18n/use-t';

type DriveRenameFileDialogProps = {
  fileId: string;
  initialName: string;
  onClose: () => void;
};

export function DriveRenameFileDialog({
  fileId,
  initialName,
  onClose,
}: DriveRenameFileDialogProps) {
  const t = useT();
  const fileErrorOverrides = {
    name_taken: t.errors.fileNameTakenHere,
    forbidden: t.errors.cannotRenameFile,
    not_found: t.errors.fileAlreadyDeleted,
  };
  const renameFile = useRenameFile();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RenameFileDto>({
    resolver: zodResolver(renameFileSchema),
    defaultValues: { name: initialName },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    renameFile.mutate(
      { id: fileId, name: values.name },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (!applyApiIssues(error, setError)) {
            setFormError(apiErrorMessage(error, fileErrorOverrides));
          }
        },
      },
    );
  });

  return (
    <Dialog
      title={t.drive.renameFile}
      onClose={onClose}
      closeDisabled={renameFile.isPending}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          id="file-name"
          label={t.drive.folderName}
          autoComplete="off"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
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
            disabled={renameFile.isPending}
            onClick={onClose}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={renameFile.isPending}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
