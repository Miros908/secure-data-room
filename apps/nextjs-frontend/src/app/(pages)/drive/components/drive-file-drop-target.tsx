'use client';

import { useState, type DragEvent, type ElementType, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { hasFileDrag, readFileDragId } from './drive-file-drag';

type DriveFileDropTargetProps = {
  enabled: boolean;
  onDropFile: (fileId: string) => void;
  className?: string;
  as?: ElementType;
  children: ReactNode;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function DriveFileDropTarget({
  enabled,
  onDropFile,
  className = '',
  as: Comp = 'div',
  children,
  onClick,
  onContextMenu,
}: DriveFileDropTargetProps) {
  const [depth, setDepth] = useState(0);
  const isOver = enabled && depth > 0;

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!enabled || !hasFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDepth((current) => current + 1);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!enabled || !hasFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!enabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDepth((current) => Math.max(0, current - 1));
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!enabled) {
      return;
    }

    const fileId = readFileDragId(event.dataTransfer);
    setDepth(0);
    if (!fileId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onDropFile(fileId);
  };

  return (
    <Comp
      className={`${className} ${isOver ? 'rounded-md bg-accent/15 ring-1 ring-accent' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </Comp>
  );
}
