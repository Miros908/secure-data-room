'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { renameFolderSchema, type RenameFolderDto } from '@sdr/shared/folders';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateFolder } from '@/app/hooks/mutations/use-create-folder';
import { useRenameFolder } from '@/app/hooks/mutations/use-rename-folder';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { apiErrorMessage } from '@/lib/api-error-message';
import { applyApiIssues } from '@/lib/apply-api-issues';
import { useToastStore } from '@/store/toast.store';
import { useT } from '@/app/lib/i18n/use-t';

type DriveFolderFormDialogProps = {
  mode: 'create' | 'rename';
  dataRoomId: string;
  parentId?: string;
  folderId?: string;
  initialName?: string;
  onClose: () => void;
};

export function DriveFolderFormDialog({
  mode,
  dataRoomId,
  parentId,
  folderId,
  initialName = '',
  onClose,
}: DriveFolderFormDialogProps) {
  const t = useT();
  const folderErrorOverrides = {
    name_taken: t.errors.folderNameTaken,
    folder_too_deep: t.errors.folder_too_deep,
  };
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const pushToast = useToastStore((state) => state.push);
  const [formError, setFormError] = useState<string | null>(null);
  const isSubmitting = createFolder.isPending || renameFolder.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RenameFolderDto>({
    resolver: zodResolver(renameFolderSchema),
    defaultValues: { name: initialName },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    if (mode === 'rename') {
      if (!folderId) {
        return;
      }

      renameFolder.mutate(
        { id: folderId, name: values.name },
        {
          onSuccess: onClose,
          onError: (error) => {
            if (!applyApiIssues(error, setError)) {
              setFormError(apiErrorMessage(error, folderErrorOverrides));
            }
          },
        },
      );
      return;
    }

    createFolder.mutate(
      parentId ? { name: values.name, parentId } : { name: values.name, dataRoomId },
      {
        onSuccess: () => {
          pushToast(t.drive.folderCreated, 'success');
          onClose();
        },
        onError: (error) => {
          if (!applyApiIssues(error, setError)) {
            setFormError(apiErrorMessage(error, folderErrorOverrides));
          }
        },
      },
    );
  });

  return (
    <Dialog
      title={mode === 'create' ? t.drive.newFolder : t.drive.renameFolder}
      onClose={onClose}
      closeDisabled={isSubmitting}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          id="folder-name"
          label={t.drive.folderName}
          autoComplete="off"
          autoFocus
          placeholder={t.drive.folderPlaceholder}
          error={errors.name?.message}
          {...register('name')}
        />

        {formError ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {mode === 'create' ? t.common.create : t.common.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
