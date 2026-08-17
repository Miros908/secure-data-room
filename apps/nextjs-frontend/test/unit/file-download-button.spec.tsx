import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadButton } from '@/app/components/file-download-button';
import { useToastStore } from '@/store/toast.store';
import { apiError, FILE_DETAIL } from '../api-error';
import { renderWithProviders } from '../render';

const recordFileDownload = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/record-file-download.poster', () => ({
  recordFileDownload,
}));

describe('FileDownloadButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    recordFileDownload.mockReset();
    useToastStore.setState({ toasts: [] });
    recordFileDownload.mockResolvedValue({
      downloadUrl: 'https://example.test/dl',
      downloadUrlExpiresAt: '2026-09-01T00:15:00.000Z',
    });
  });

  it('opens the attachment URL after a successful POST', async () => {
    const user = userEvent.setup();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderWithProviders(<FileDownloadButton fileId={FILE_DETAIL.id} />);
    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(recordFileDownload).toHaveBeenCalledWith({
        id: FILE_DETAIL.id,
        token: undefined,
        versionId: undefined,
      });
    });
    expect(click).toHaveBeenCalled();
  });

  it('toasts when the download POST fails', async () => {
    const user = userEvent.setup();
    recordFileDownload.mockRejectedValue(
      apiError({ code: 'not_found', statusCode: 404 }),
    );

    renderWithProviders(<FileDownloadButton fileId={FILE_DETAIL.id} />);
    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        message: 'File not found',
        tone: 'danger',
      });
    });
  });
});
