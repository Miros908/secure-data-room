'use client';

import type { DriveUploadItem } from '@/app/hooks/mutations/use-upload-files';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';

type DriveUploadQueueProps = {
  items: DriveUploadItem[];
  onDismiss: (id: string) => void;
};

export function DriveUploadQueue({ items, onDismiss }: DriveUploadQueueProps) {
  const t = useT();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-40 w-[min(100%-2rem,22rem)] rounded-xl border border-border bg-surface p-3 shadow-[0_16px_40px_rgb(17_29_50/0.14)] md:right-4 md:bottom-4 md:left-auto dark:shadow-[0_16px_40px_rgb(0_0_0/0.45)]">
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        {t.drive.uploads}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-fg" title={item.name}>
                {item.name}
              </p>
              {item.status === 'error' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={t.common.hide}
                  onClick={() => onDismiss(item.id)}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <span className="shrink-0 text-xs text-muted">{item.progress}%</span>
              )}
            </div>

            {item.status === 'uploading' ? (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.progress}
                aria-label={t.drive.uploadingFile(item.name)}
                className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            ) : (
              <p role="alert" className="text-xs text-danger">
                {item.errorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
