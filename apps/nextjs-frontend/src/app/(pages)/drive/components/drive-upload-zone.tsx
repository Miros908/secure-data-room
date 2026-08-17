'use client';

import { useState, type ReactNode } from 'react';
import { hasFileDrag } from './drive-file-drag';
import { useT } from '@/app/lib/i18n/use-t';

type DriveUploadZoneProps = {
  enabled: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
};

export function DriveUploadZone({
  enabled,
  onFiles,
  children,
}: DriveUploadZoneProps) {
  const t = useT();
  const [dragDepth, setDragDepth] = useState(0);
  const isDragging = enabled && dragDepth > 0;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!enabled || !hasOsFiles(event)) {
          return;
        }

        event.preventDefault();
        setDragDepth((depth) => depth + 1);
      }}
      onDragOver={(event) => {
        if (!enabled || !hasOsFiles(event)) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        if (!enabled) {
          return;
        }

        event.preventDefault();
        setDragDepth((depth) => Math.max(0, depth - 1));
      }}
      onDrop={(event) => {
        if (!enabled || hasFileDrag(event.dataTransfer)) {
          return;
        }

        event.preventDefault();
        setDragDepth(0);
        const list = event.dataTransfer.files;
        if (list.length > 0) {
          onFiles(Array.from(list));
        }
      }}
    >
      {children}

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10">
          <p className="rounded-md bg-surface px-3 py-2 text-sm font-medium text-fg">
            {t.drive.dropHere}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function hasOsFiles(event: { dataTransfer: DataTransfer }): boolean {
  if (hasFileDrag(event.dataTransfer)) {
    return false;
  }

  return Array.from(event.dataTransfer.types).includes('Files');
}
