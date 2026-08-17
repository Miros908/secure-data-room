'use client';

import { useState } from 'react';
import { useDeleteFile } from '@/app/hooks/mutations/use-delete-file';
import { useDeleteFolder } from '@/app/hooks/mutations/use-delete-folder';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useT } from '@/app/lib/i18n/use-t';

export type BulkDeleteItem = {
  kind: 'folder' | 'file';
  id: string;
  name: string;
};

type DriveBulkDeleteDialogProps = {
  items: BulkDeleteItem[];
  onClose: () => void;
  onDeleted: (ids: string[]) => void;
};

export function DriveBulkDeleteDialog({
  items,
  onClose,
  onDeleted,
}: DriveBulkDeleteDialogProps) {
  const t = useT();
  const deleteFile = useDeleteFile();
  const deleteFolder = useDeleteFolder();
  const [formError, setFormError] = useState<string | null>(null);
  const isPending = deleteFile.isPending || deleteFolder.isPending;
  const folders = items.filter((item) => item.kind === 'folder');

  const onConfirm = async () => {
    setFormError(null);
    const deleted: string[] = [];
    try {
      for (const item of items) {
        if (item.kind === 'file') {
          await deleteFile.mutateAsync(item.id);
        } else {
          await deleteFolder.mutateAsync(item.id);
        }
        deleted.push(item.id);
      }
      onDeleted(deleted);
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError
          ? apiErrorMessage(error, {
              forbidden: t.errors.cannotDeleteSelected,
              not_found: t.errors.alreadyDeleted,
            })
          : t.errors.deleteSelectedFailed,
      );
    }
  };

  return (
    <Dialog
      title={t.drive.deleteSelectedTitle}
      onClose={onClose}
      closeDisabled={isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg">
          {items.length === 1
            ? t.drive.deleteSelectedOne(items[0].name)
            : t.drive.deleteSelectedMany}
          {folders.length > 0 ? t.drive.deleteFoldersNote : ''}
        </p>
        <ul className="max-h-40 overflow-y-auto rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted">
          {items.slice(0, 8).map((item) => (
            <li key={`${item.kind}:${item.id}`} className="truncate">
              {item.name}
            </li>
          ))}
          {items.length > 8 ? (
            <li>{t.drive.andMore(items.length - 8)}</li>
          ) : null}
        </ul>
        {formError ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isPending}
            onClick={() => void onConfirm()}
          >
            {t.common.delete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
