import type { FolderContents } from '@sdr/shared/folders';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveBrowser } from '@/app/(pages)/drive/components/drive-browser';
import { resetRecordedFileViews } from '@/app/hooks/use-record-file-view';
import { FILE_DETAIL } from '../api-error';
import { routerPush, routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const getFile = vi.hoisted(() => vi.fn());
const getMe = vi.hoisted(() => vi.fn());
const recordFileView = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/get-file.fetcher', () => ({
  getFile,
}));

vi.mock('@/app/api/get-me.fetcher', () => ({
  getMe,
}));

vi.mock('@/app/api/record-file-view.poster', () => ({
  recordFileView,
}));

const sharing = {
  peopleCount: 0,
  pendingCount: 0,
  hasPublicLink: false,
  inheritedFrom: null,
};

function contents(role: FolderContents['role']): FolderContents {
  return {
    folder: null,
    dataRoomId: FILE_DETAIL.dataRoomId,
    role,
    accessExpiresAt: null,
    breadcrumbs: [],
    folders: [],
    files: [
      {
        id: FILE_DETAIL.id,
        name: FILE_DETAIL.name,
        createdAt: FILE_DETAIL.createdAt,
        sizeBytes: FILE_DETAIL.sizeBytes,
        mimeType: FILE_DETAIL.mimeType,
        versionCount: FILE_DETAIL.versionCount,
        sharing,
      },
    ],
  };
}

function renderBrowser(role: FolderContents['role'], fileId?: string) {
  return renderWithProviders(
    <DriveBrowser
      isLoading={false}
      error={null}
      onRetry={vi.fn()}
      search=""
      openCreate={false}
      openUpload={false}
      onCreateOpened={vi.fn()}
      onUploadOpened={vi.fn()}
      contents={contents(role)}
      fileId={fileId}
    />,
  );
}

describe('DriveBrowser selection', () => {
  beforeEach(() => {
    resetRecordedFileViews();
    getFile.mockReset();
    getMe.mockReset();
    recordFileView.mockReset();
    getFile.mockResolvedValue(FILE_DETAIL);
    getMe.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'viewer@example.com',
      name: 'Viewer',
    });
    recordFileView.mockResolvedValue({ ok: true });
  });

  it('shows the selection bar when the owner checks a file', async () => {
    const user = userEvent.setup();
    renderBrowser('owner');

    await user.click(
      screen.getByRole('checkbox', { name: `Select ${FILE_DETAIL.name}` }),
    );
    expect(screen.getByText('Selected: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
  });

  it('opens a file when the owner clicks the row', async () => {
    const user = userEvent.setup();
    renderBrowser('owner');

    await user.click(screen.getByText('1.0 KB'));
    expect(screen.queryByText('Selected: 1')).not.toBeInTheDocument();
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining(`fileId=${FILE_DETAIL.id}`),
      { scroll: false },
    );
  });

  it('opens a shared file instead of showing the selection bar', async () => {
    const user = userEvent.setup();
    renderBrowser('viewer');

    await user.click(screen.getByText('1.0 KB'));
    expect(screen.queryByText('Selected: 1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear selection' }),
    ).not.toBeInTheDocument();
    expect(routerPush).toHaveBeenCalledWith(
      expect.stringContaining(`fileId=${FILE_DETAIL.id}`),
      { scroll: false },
    );
  });

  it('shows the preview overlay from the file URL', async () => {
    renderBrowser('viewer', FILE_DETAIL.id);

    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'file-viewer-title',
    );
  });

  it('closes preview back to the open folder', async () => {
    const user = userEvent.setup();
    const folderId = '55555555-5555-4555-8555-555555555555';
    renderWithProviders(
      <DriveBrowser
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        search=""
        openCreate={false}
        openUpload={false}
        onCreateOpened={vi.fn()}
        onUploadOpened={vi.fn()}
        myRoomId="11111111-1111-4111-8111-111111111111"
        contents={{
          ...contents('viewer'),
          folder: {
            id: folderId,
            name: 'Legal',
            parentId: null,
            dataRoomId: FILE_DETAIL.dataRoomId,
            createdAt: FILE_DETAIL.createdAt,
          },
        }}
        fileId={FILE_DETAIL.id}
      />,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(routerReplace).toHaveBeenCalledWith(
      `/drive?folderId=${folderId}&dataRoomId=${FILE_DETAIL.dataRoomId}`,
    );
  });
});
