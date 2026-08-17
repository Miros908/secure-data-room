import { useEffect } from 'react';
import { recordFileView } from '@/app/api/record-file-view.poster';

const recordedViewKeys = new Set<string>();

export function resetRecordedFileViews(): void {
  recordedViewKeys.clear();
}

export function useRecordFileView(
  fileId: string | undefined,
  token?: string,
) {
  useEffect(() => {
    if (!fileId) {
      return;
    }

    const key = `${fileId}:${token ?? ''}`;
    if (recordedViewKeys.has(key)) {
      return;
    }
    recordedViewKeys.add(key);

    void recordFileView(fileId, token).catch(() => {
      recordedViewKeys.delete(key);
    });
  }, [fileId, token]);
}
