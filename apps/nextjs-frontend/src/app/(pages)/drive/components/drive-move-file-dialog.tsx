'use client';

import { useState } from 'react';
import { useMoveFile } from '@/app/hooks/mutations/use-move-file';
import { useFolderContents } from '@/app/hooks/queries/use-folder-contents';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from '@/components/ui/icons';
import { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useT } from '@/app/lib/i18n/use-t';

type DriveMoveFileDialogProps = {
  fileId: string;
  fileIds?: string[];
  fileName: string;
  dataRoomId: string;
  rootName: string;
  currentFolderId: string | null;
  onClose: () => void;
};

export function DriveMoveFileDialog({
  fileId,
  fileIds,
  fileName,
  dataRoomId,
  rootName,
  currentFolderId,
  onClose,
}: DriveMoveFileDialogProps) {
  const t = useT();
  const moveErrorOverrides = {
    name_taken: t.errors.fileNameTakenHere,
    invalid_destination: t.errors.invalid_destination,
    forbidden: t.errors.cannotMoveFile,
    not_found: t.errors.fileAlreadyDeleted,
  };
  const moveFile = useMoveFile();
  const ids = fileIds && fileIds.length > 0 ? fileIds : [fileId];
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const unchanged = selectedFolderId === currentFolderId;

  const onConfirm = () => {
    if (unchanged) {
      return;
    }

    setFormError(null);
    void (async () => {
      try {
        for (const id of ids) {
          await moveFile.mutateAsync({ id, folderId: selectedFolderId });
        }
        onClose();
      } catch (error) {
        setFormError(
          error instanceof ApiRequestError
            ? apiErrorMessage(error, moveErrorOverrides)
            : t.errors.moveFailed,
        );
      }
    })();
  };

  return (
    <Dialog
      title={
        ids.length > 1 ? t.drive.moveMany(ids.length) : t.drive.moveFile
      }
      onClose={onClose}
      closeDisabled={moveFile.isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg">
          {ids.length > 1
            ? t.drive.chooseFolder
            : t.drive.chooseFolderFor(fileName)}
        </p>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          <FolderPickerNode
            dataRoomId={dataRoomId}
            name={rootName}
            depth={0}
            currentFolderId={currentFolderId}
            selectedFolderId={selectedFolderId}
            onSelect={setSelectedFolderId}
          />
        </div>

        {formError ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={moveFile.isPending}
            onClick={onClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={unchanged}
            isLoading={moveFile.isPending}
            onClick={onConfirm}
          >
            {t.common.move}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function FolderPickerNode({
  dataRoomId,
  folderId,
  name,
  depth,
  currentFolderId,
  selectedFolderId,
  onSelect,
}: {
  dataRoomId: string;
  folderId?: string;
  name: string;
  depth: number;
  currentFolderId: string | null;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const t = useT();
  const nodeId = folderId ?? null;
  const [expanded, setExpanded] = useState(folderId === undefined);
  const contents = useFolderContents({
    dataRoomId,
    folderId,
    enabled: expanded,
  });

  const childFolders = contents.data?.folders ?? [];
  const hasLoaded = Boolean(contents.data);
  const canExpand = !hasLoaded || childFolders.length > 0;
  const isSelected = selectedFolderId === nodeId;
  const isCurrent = currentFolderId === nodeId;

  return (
    <div>
      <div
        className={`flex items-center gap-0.5 pr-2 ${
          isSelected ? 'bg-accent/10' : 'hover:bg-surface-muted'
        }`}
        style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
      >
        {canExpand ? (
          <button
            type="button"
            aria-label={expanded ? t.common.collapse : t.common.expand}
            aria-expanded={expanded}
            className="inline-flex h-8 w-7 shrink-0 items-center justify-center text-muted"
            onClick={() => setExpanded((current) => !current)}
          >
            <span aria-hidden>
              {expanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </span>
          </button>
        ) : (
          <span className="inline-block w-7 shrink-0" />
        )}
        <button
          type="button"
          aria-pressed={isSelected}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
          onClick={() => onSelect(nodeId)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderIcon className="h-4 w-4 shrink-0 text-folder" />
            <span className="truncate text-sm text-fg" title={name}>
              {name}
            </span>
          </span>
          {isCurrent ? (
            <span className="shrink-0 text-xs text-muted">
              {t.drive.currentFolder}
            </span>
          ) : null}
        </button>
      </div>

      {expanded ? (
        contents.isPending ? (
          <p
            className="py-1.5 text-sm text-muted"
            style={{ paddingLeft: `${1.75 + depth * 0.75}rem` }}
          >
            {t.common.loading}
          </p>
        ) : contents.error ? (
          <p
            className="py-1.5 text-sm text-danger"
            style={{ paddingLeft: `${1.75 + depth * 0.75}rem` }}
          >
            {t.drive.folderPickerFailed}
          </p>
        ) : (
          childFolders.map((folder) => (
            <FolderPickerNode
              key={folder.id}
              dataRoomId={dataRoomId}
              folderId={folder.id}
              name={folder.name}
              depth={depth + 1}
              currentFolderId={currentFolderId}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))
        )
      ) : null}
    </div>
  );
}
