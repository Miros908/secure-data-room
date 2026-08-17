'use client';

import { Button } from '@/components/ui/button';
import {
  ExternalIcon,
  HistoryIcon,
  MoreIcon,
  MoveIcon,
  OpenIcon,
  PencilIcon,
  ShareIcon,
  TrashIcon,
} from '@/components/ui/icons';
import { DropdownMenu, type MenuAction } from '@/components/ui/menu';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';

type DriveItemMenuProps = {
  label: string;
  className?: string;
  onOpen?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onShowInFolder?: () => void;
  onVersionHistory?: () => void;
};

export function DriveItemMenu({
  label,
  className,
  onOpen,
  onShare,
  onRename,
  onMove,
  onDelete,
  onShowInFolder,
  onVersionHistory,
}: DriveItemMenuProps) {
  const t = useT();
  const actions: MenuAction[] = [];
  if (onOpen) {
    actions.push({
      id: 'open',
      label: t.common.open,
      icon: <OpenIcon className="h-4 w-4" />,
      onSelect: onOpen,
    });
  }
  if (onVersionHistory) {
    actions.push({
      id: 'versions',
      label: t.drive.versionHistory,
      icon: <HistoryIcon className="h-4 w-4" />,
      onSelect: onVersionHistory,
    });
  }
  if (onShowInFolder) {
    actions.push({
      id: 'show',
      label: t.drive.showInFolder,
      icon: <ExternalIcon className="h-4 w-4" />,
      onSelect: onShowInFolder,
    });
  }
  if (onShare) {
    actions.push({
      id: 'share',
      label: t.common.share,
      icon: <ShareIcon className="h-4 w-4" />,
      onSelect: onShare,
    });
  }
  if (onRename) {
    actions.push({
      id: 'rename',
      label: t.common.rename,
      icon: <PencilIcon className="h-4 w-4" />,
      onSelect: onRename,
    });
  }
  if (onMove) {
    actions.push({
      id: 'move',
      label: t.common.move,
      icon: <MoveIcon className="h-4 w-4" />,
      onSelect: onMove,
    });
  }
  if (onDelete) {
    actions.push({
      id: 'delete',
      label: t.common.delete,
      icon: <TrashIcon className="h-4 w-4" />,
      tone: 'danger',
      onSelect: onDelete,
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      label={label}
      actions={actions}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cx('h-8 w-8', className)}
          aria-label={label}
          aria-haspopup="menu"
        >
          <MoreIcon className="h-4 w-4" />
        </Button>
      }
    />
  );
}
