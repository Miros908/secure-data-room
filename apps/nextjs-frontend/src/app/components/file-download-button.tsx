'use client';

import { useState } from 'react';
import { recordFileDownload } from '@/app/api/record-file-download.poster';
import { DownloadIcon } from '@/components/ui/icons';
import { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cx } from '@/lib/cx';
import { useToastStore } from '@/store/toast.store';
import { useT } from '@/app/lib/i18n/use-t';

type FileDownloadButtonProps = {
  fileId: string;
  token?: string;
  versionId?: string;
  className?: string;
};

export function FileDownloadButton({
  fileId,
  token,
  versionId,
  className,
}: FileDownloadButtonProps) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const pushToast = useToastStore((state) => state.push);

  const onClick = async () => {
    setPending(true);
    try {
      const result = await recordFileDownload({
        id: fileId,
        token,
        versionId,
      });
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.rel = 'noreferrer';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      pushToast(
        error instanceof ApiRequestError
          ? apiErrorMessage(error, { not_found: t.drive.fileNotFound })
          : t.errors.internal_error,
        'danger',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={t.common.download}
      disabled={pending}
      onClick={() => void onClick()}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-viewer-fg hover:bg-white/10 sm:px-3',
        'disabled:opacity-60',
        className,
      )}
    >
      <DownloadIcon className="h-4 w-4" />
      <span className="hidden sm:inline">{t.common.download}</span>
    </button>
  );
}
