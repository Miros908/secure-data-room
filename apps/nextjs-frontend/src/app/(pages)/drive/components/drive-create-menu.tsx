'use client';

import { Button } from '@/components/ui/button';
import {
  FolderPlusIcon,
  PlusIcon,
  UploadIcon,
} from '@/components/ui/icons';
import { DropdownMenu, type MenuAction } from '@/components/ui/menu';
import { useT } from '@/app/lib/i18n/use-t';

type DriveCreateMenuProps = {
  disabled?: boolean;
  onCreateFolder: () => void;
  onUpload: () => void;
  fullWidth?: boolean;
  compact?: boolean;
};

export function DriveCreateMenu({
  disabled = false,
  onCreateFolder,
  onUpload,
  fullWidth = false,
  compact = false,
}: DriveCreateMenuProps) {
  const t = useT();
  const actions: MenuAction[] = [
    {
      id: 'folder',
      label: t.drive.newFolder,
      icon: <FolderPlusIcon className="h-4 w-4" />,
      onSelect: onCreateFolder,
    },
    {
      id: 'upload',
      label: t.drive.uploadPdf,
      icon: <UploadIcon className="h-4 w-4" />,
      onSelect: onUpload,
    },
  ];

  return (
    <DropdownMenu
      label={t.drive.new}
      align="left"
      actions={actions}
      trigger={
        <Button
          type="button"
          disabled={disabled}
          size={compact ? 'icon' : 'md'}
          className={fullWidth && !compact ? 'w-full' : ''}
          aria-haspopup="menu"
          aria-label={t.drive.new}
        >
          <PlusIcon className="h-4 w-4" />
          {compact ? null : t.drive.new}
        </Button>
      }
    />
  );
}
