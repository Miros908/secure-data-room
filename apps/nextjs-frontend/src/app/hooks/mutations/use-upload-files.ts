import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadFile } from '@/app/api/upload-file.poster';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import { getMessages } from '@/app/lib/i18n/get-messages';
import { ApiRequestError } from '@/infrastructure/http/api-error';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useToastStore } from '@/store/toast.store';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 3;
const DONE_HIDE_MS = 800;

export type DriveUploadItem = {
  id: string;
  name: string;
  status: 'uploading' | 'error';
  progress: number;
  errorMessage?: string;
};

export type UploadTarget = {
  dataRoomId: string;
  folderId?: string;
};

export function useUploadFiles() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.push);
  const [items, setItems] = useState<DriveUploadItem[]>([]);

  const patchItem = (id: string, patch: Partial<DriveUploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const uploadFiles = useCallback(
    async (files: File[], target: UploadTarget) => {
      const t = getMessages();

      if (files.length === 0) {
        return;
      }

      const uploadErrorOverrides = {
        name_taken: t.upload.nameTaken,
        invalid_file_type: t.upload.pdfOnly,
        file_too_large: t.upload.tooLarge,
        forbidden: t.upload.forbidden,
      };

      const jobs: Array<{ id: string; file: File }> = [];
      const immediate: DriveUploadItem[] = [];

      for (const file of files) {
        const id = crypto.randomUUID();
        const localError = describeLocalFileError(file, uploadErrorOverrides, t.upload.empty);

        if (localError) {
          immediate.push({
            id,
            name: file.name,
            status: 'error',
            progress: 0,
            errorMessage: localError,
          });
          continue;
        }

        immediate.push({
          id,
          name: file.name,
          status: 'uploading',
          progress: 0,
        });
        jobs.push({ id, file });
      }

      setItems((current) => [...current, ...immediate]);

      let uploaded = 0;
      let versioned = 0;
      let failed = immediate.filter((item) => item.status === 'error').length;

      await runPool(jobs, UPLOAD_CONCURRENCY, async (job) => {
        try {
          const saved = await uploadFile(
            {
              file: job.file,
              dataRoomId: target.dataRoomId,
              folderId: target.folderId,
            },
            (percent) => patchItem(job.id, { progress: percent }),
          );

          patchItem(job.id, { progress: 100 });
          if (saved.isNewVersion) {
            versioned += 1;
          } else {
            uploaded += 1;
          }
          void queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all });
          void queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
          void queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });

          window.setTimeout(() => {
            setItems((current) => current.filter((item) => item.id !== job.id));
          }, DONE_HIDE_MS);
        } catch (error) {
          failed += 1;
          patchItem(job.id, {
            status: 'error',
            progress: 0,
            errorMessage: uploadErrorMessage(error, uploadErrorOverrides, t.upload.failed),
          });
        }
      });

      if (uploaded + versioned > 0 && failed === 0) {
        if (versioned > 0 && uploaded === 0) {
          pushToast(
            versioned === 1
              ? t.upload.newVersion
              : t.upload.newVersions(versioned),
            'success',
          );
        } else {
          pushToast(
            uploaded + versioned === 1
              ? t.upload.uploaded
              : t.upload.uploadedMany(uploaded + versioned),
            'success',
          );
        }
      } else if (failed > 0) {
        pushToast(
          failed === 1 ? t.upload.failed : t.upload.failedMany(failed),
          'danger',
        );
      }
    },
    [queryClient, pushToast],
  );

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, uploadFiles, dismiss };
}

function describeLocalFileError(
  file: File,
  overrides: {
    invalid_file_type: string;
    file_too_large: string;
  },
  emptyMessage: string,
): string | null {
  if (!isLikelyPdf(file)) {
    return overrides.invalid_file_type;
  }

  if (file.size === 0) {
    return emptyMessage;
  }

  if (file.size > MAX_FILE_BYTES) {
    return overrides.file_too_large;
  }

  return null;
}

function isLikelyPdf(file: File): boolean {
  if (file.type === 'application/pdf') {
    return true;
  }

  return file.name.toLowerCase().endsWith('.pdf');
}

function uploadErrorMessage(
  error: unknown,
  overrides: {
    name_taken: string;
    invalid_file_type: string;
    file_too_large: string;
    forbidden: string;
  },
  fallback: string,
): string {
  if (error instanceof ApiRequestError) {
    return apiErrorMessage(error, overrides);
  }

  return fallback;
}

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  const runNext = async (): Promise<void> => {
    const current = index;
    index += 1;
    const item = items[current];

    if (!item) {
      return;
    }

    await worker(item);
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
}
