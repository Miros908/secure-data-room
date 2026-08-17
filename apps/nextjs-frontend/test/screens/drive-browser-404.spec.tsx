import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriveBrowser } from '@/app/(pages)/drive/components/drive-browser';
import { LiveAccessNoticeProvider } from '@/app/hooks/use-live-notice';
import { getMessages } from '@/app/lib/i18n/get-messages';
import { apiError } from '../api-error';
import { routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const { live } = getMessages();

describe('DriveBrowser 404', () => {
  it('shows a safe error and returns to /drive', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <DriveBrowser
        isLoading={false}
        error={apiError({ code: 'not_found', statusCode: 404 })}
        onRetry={onRetry}
        search=""
        openCreate={false}
        openUpload={false}
        onCreateOpened={vi.fn()}
        onUploadOpened={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Folder not found');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'My Drive' }));
    expect(routerReplace).toHaveBeenCalledWith('/drive');
  });

  it('shows the live folder-gone copy after a concurrent delete', () => {
    renderWithProviders(
      <LiveAccessNoticeProvider
        notice={{
          type: 'resource_gone',
          reason: 'deleted',
          dataRoomId: '33333333-3333-4333-8333-333333333333',
          subject: {
            kind: 'folder',
            id: '44444444-4444-4444-8444-444444444444',
          },
        }}
      >
        <DriveBrowser
          isLoading={false}
          error={apiError({ code: 'not_found', statusCode: 404 })}
          onRetry={vi.fn()}
          search=""
          openCreate={false}
          openUpload={false}
          onCreateOpened={vi.fn()}
          onUploadOpened={vi.fn()}
        />
      </LiveAccessNoticeProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(live.folderGone);
  });

  it('does not show a countdown to the owner', () => {
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
        contents={{
          folder: null,
          dataRoomId: '33333333-3333-4333-8333-333333333333',
          role: 'owner',
          accessExpiresAt: '2026-08-17T12:00:00.000Z',
          breadcrumbs: [],
          folders: [],
          files: [],
        }}
      />,
    );

    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
    expect(screen.queryByText('Access expired')).not.toBeInTheDocument();
  });

  it('shows a countdown to a viewer with timed access', () => {
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
        contents={{
          folder: null,
          dataRoomId: '33333333-3333-4333-8333-333333333333',
          role: 'viewer',
          accessExpiresAt: '2026-08-17T12:00:00.000Z',
          breadcrumbs: [],
          folders: [],
          files: [],
        }}
      />,
    );

    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
  });
});
