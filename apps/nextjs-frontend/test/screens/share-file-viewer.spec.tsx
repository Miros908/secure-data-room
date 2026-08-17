import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareFileViewer } from '@/app/(pages)/share/components/share-file-viewer';
import { resetRecordedFileViews } from '@/app/hooks/use-record-file-view';
import { publicWatermarkWho } from '@/app/components/pdf-watermark';
import { LiveAccessNoticeProvider } from '@/app/hooks/use-live-notice';
import { getMessages } from '@/app/lib/i18n/get-messages';
import { apiError, FILE_DETAIL, USER } from '../api-error';
import { renderWithProviders } from '../render';

const getFile = vi.hoisted(() => vi.fn());
const getMe = vi.hoisted(() => vi.fn());
const listFileVersions = vi.hoisted(() => vi.fn());
const getFileVersion = vi.hoisted(() => vi.fn());
const recordFileView = vi.hoisted(() => vi.fn());
const recordFileDownload = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/get-file.fetcher', () => ({
  getFile,
}));

vi.mock('@/app/api/get-me.fetcher', () => ({
  getMe,
}));

vi.mock('@/app/api/list-file-versions.fetcher', () => ({
  listFileVersions,
}));

vi.mock('@/app/api/get-file-version.fetcher', () => ({
  getFileVersion,
}));

vi.mock('@/app/api/record-file-view.poster', () => ({
  recordFileView,
}));

vi.mock('@/app/api/record-file-download.poster', () => ({
  recordFileDownload,
}));

const { live } = getMessages();

describe('ShareFileViewer', () => {
  beforeEach(() => {
    resetRecordedFileViews();
    getFile.mockReset();
    getMe.mockReset();
    listFileVersions.mockReset();
    getFileVersion.mockReset();
    recordFileView.mockReset();
    recordFileDownload.mockReset();
    getFile.mockResolvedValue(FILE_DETAIL);
    getMe.mockResolvedValue(USER);
    listFileVersions.mockResolvedValue({ versions: [] });
    recordFileView.mockResolvedValue({ ok: true });
    recordFileDownload.mockResolvedValue({
      downloadUrl: 'https://example.test/dl',
      downloadUrlExpiresAt: '2026-09-01T00:15:00.000Z',
    });
  });

  it('opens the PDF with no-referrer', async () => {
    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeTruthy();
    });
    expect(document.querySelector('iframe')?.referrerPolicy).toBe('no-referrer');
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
    await waitFor(() => {
      expect(recordFileView).toHaveBeenCalledWith(
        FILE_DETAIL.id,
        'public-token',
      );
    });
  });

  it('records a download with the public token when Download is clicked', async () => {
    const user = userEvent.setup();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );
    await user.click(await screen.findByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(recordFileDownload).toHaveBeenCalledWith({
        id: FILE_DETAIL.id,
        token: 'public-token',
        versionId: undefined,
      });
    });
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('does not watermark when the owner opens their own public link', async () => {
    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeTruthy();
    });
    expect(document.querySelector('[data-pdf-watermark]')).toBeNull();
  });

  it('watermarks a signed-in viewer with their email', async () => {
    getFile.mockResolvedValue({ ...FILE_DETAIL, role: 'viewer' as const });
    getMe.mockResolvedValue({ ...USER, email: 'viewer@example.com' });

    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-pdf-watermark]')).toBeTruthy();
    });
    expect(document.querySelector('[data-pdf-watermark]')?.textContent).toContain(
      'viewer@example.com',
    );
  });

  it('watermarks an anonymous public link with the public-link label', async () => {
    getFile.mockResolvedValue({ ...FILE_DETAIL, role: 'viewer' as const });
    getMe.mockRejectedValue(apiError({ code: 'unauthorized', statusCode: 401 }));

    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-pdf-watermark]')).toBeTruthy();
    });
    expect(document.querySelector('[data-pdf-watermark]')?.textContent).toContain(
      publicWatermarkWho(),
    );
  });

  it('switches the iframe to an older version on a public link', async () => {
    const user = userEvent.setup();
    const oldId = '55555555-5555-4555-8555-555555555555';
    getFile.mockResolvedValue({
      ...FILE_DETAIL,
      versionNumber: 2,
      versionCount: 2,
    });
    listFileVersions.mockResolvedValue({
      versions: [
        {
          id: FILE_DETAIL.currentVersionId,
          versionNumber: 2,
          sizeBytes: 1024,
          createdAt: FILE_DETAIL.createdAt,
          uploadedByName: 'Owner',
        },
        {
          id: oldId,
          versionNumber: 1,
          sizeBytes: 512,
          createdAt: '2026-08-15T12:00:00.000Z',
          uploadedByName: 'Owner',
        },
      ],
    });
    getFileVersion.mockResolvedValue({
      ...FILE_DETAIL,
      versionNumber: 1,
      versionCount: 2,
      downloadUrl: 'about:blank#share-v1',
    });

    renderWithProviders(
      <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'File version' })).toBeTruthy();
    });
    await user.click(screen.getByRole('button', { name: 'File version' }));
    await user.click(await screen.findByRole('option', { name: /Version 1/ }));

    await waitFor(() => {
      expect(document.querySelector('iframe')).toHaveAttribute(
        'data-pdf-src',
        'about:blank#share-v1',
      );
    });
  });

  it('closes the PDF with a revoke message after a live 404', async () => {
    getFile.mockRejectedValue(apiError({ code: 'not_found', statusCode: 404 }));

    renderWithProviders(
      <LiveAccessNoticeProvider
        notice={{
          type: 'access_invalidated',
          reason: 'revoked',
          dataRoomId: FILE_DETAIL.dataRoomId,
          target: { kind: 'file', id: FILE_DETAIL.id },
        }}
      >
        <ShareFileViewer fileId={FILE_DETAIL.id} token="public-token" />
      </LiveAccessNoticeProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(live.fileRevoked);
    expect(document.querySelector('iframe')).toBeNull();
  });
});
