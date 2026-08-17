import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, useUploadFiles } from '@/app/hooks/mutations/use-upload-files';
import { useToastStore } from '@/store/toast.store';
import { apiError } from '../api-error';

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/upload-file.poster', () => ({
  uploadFile,
}));

const TARGET = {
  dataRoomId: '33333333-3333-4333-8333-333333333333',
};

const FILE_DTO = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'a.pdf',
  dataRoomId: TARGET.dataRoomId,
  folderId: null,
  mimeType: 'application/pdf',
  sizeBytes: 12,
  versionNumber: 1,
  versionCount: 1,
  isNewVersion: false,
  createdAt: '2026-08-16T12:00:00.000Z',
};

function pdf(name: string) {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe('useUploadFiles', () => {
  beforeEach(() => {
    uploadFile.mockReset();
    useToastStore.setState({ toasts: [] });
  });

  it('does not call the API for a non-PDF or an oversized file', async () => {
    const { result } = renderHook(() => useUploadFiles(), {
      wrapper: createWrapper(),
    });
    const huge = pdf('huge.pdf');
    Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });

    await act(async () => {
      await result.current.uploadFiles(
        [new File(['hi'], 'notes.txt', { type: 'text/plain' }), huge],
        TARGET,
      );
    });

    expect(uploadFile).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.every((item) => item.status === 'error')).toBe(
      true,
    );
  });

  it('keeps concurrency at 3', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    uploadFile.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => {
        setTimeout(resolve, 40);
      });
      inFlight -= 1;
      return FILE_DTO;
    });

    const { result } = renderHook(() => useUploadFiles(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.uploadFiles(
        [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf'), pdf('4.pdf')],
        TARGET,
      );
    });

    expect(maxInFlight).toBe(3);
    expect(uploadFile).toHaveBeenCalledTimes(4);
  });

  it('does not stop the batch when one file fails', async () => {
    uploadFile
      .mockRejectedValueOnce(apiError({ code: 'internal_error', statusCode: 500 }))
      .mockResolvedValueOnce(FILE_DTO);

    const { result } = renderHook(() => useUploadFiles(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.uploadFiles([pdf('bad.pdf'), pdf('ok.pdf')], TARGET);
    });

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(result.current.items.some((item) => item.status === 'error')).toBe(
      true,
    );
    expect(
      useToastStore.getState().toasts.some((toast) => toast.tone === 'danger'),
    ).toBe(true);
  });

  it('toasts a new version instead of name_taken', async () => {
    uploadFile.mockResolvedValue({ ...FILE_DTO, isNewVersion: true, versionNumber: 2, versionCount: 2 });

    const { result } = renderHook(() => useUploadFiles(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.uploadFiles([pdf('a.pdf')], TARGET);
    });

    expect(
      useToastStore.getState().toasts.some(
        (toast) => toast.tone === 'success' && toast.message === 'New version uploaded',
      ),
    ).toBe(true);
    expect(result.current.items.every((item) => item.status !== 'error')).toBe(
      true,
    );
  });
});
