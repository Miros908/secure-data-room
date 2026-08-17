import type { LiveEvent } from '@sdr/shared/events';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareScreen } from '@/app/(pages)/share/components/share-screen';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { apiError, FILE_DETAIL, USER } from '../api-error';
import { setSearchParams } from '../navigation';
import { renderWithProviders } from '../render';

const getMe = vi.hoisted(() => vi.fn());
const getFile = vi.hoisted(() => vi.fn());
const resolvePublicLink = vi.hoisted(() => vi.fn());
const connectLiveEvents = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/get-me.fetcher', () => ({
  getMe,
}));

vi.mock('@/app/api/get-file.fetcher', () => ({
  getFile,
}));

vi.mock('@/app/api/resolve-public-link.fetcher', () => ({
  resolvePublicLink,
}));

vi.mock('@/app/lib/connect-live-events', () => ({
  connectLiveEvents,
}));

const LINK = {
  type: 'file' as const,
  subjectId: FILE_DETAIL.id,
  dataRoomId: FILE_DETAIL.dataRoomId,
  accessExpiresAt: '2099-01-01T12:00:00.000Z',
};

const revoked: LiveEvent = {
  type: 'access_invalidated',
  reason: 'revoked',
  dataRoomId: FILE_DETAIL.dataRoomId,
  target: { kind: 'file', id: FILE_DETAIL.id },
};

describe('ShareScreen', () => {
  beforeEach(() => {
    getMe.mockReset();
    getFile.mockReset();
    resolvePublicLink.mockReset();
    connectLiveEvents.mockReset();
    getMe.mockResolvedValue(USER);
    getFile.mockImplementation(() => new Promise(() => undefined));
    connectLiveEvents.mockReturnValue({ close: () => undefined });
  });

  it('shows a generic unavailable state when the token is missing', async () => {
    renderWithProviders(<ShareScreen />);

    expect(screen.getByText("This link isn't available")).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the link or ask for a new one',
    );
    expect(resolvePublicLink).not.toHaveBeenCalled();
  });

  it('does not leak names when the public link is gone', async () => {
    setSearchParams({ token: 'dead-token' });
    resolvePublicLink.mockRejectedValue(
      apiError({ code: 'not_found', statusCode: 404 }),
    );
    renderWithProviders(<ShareScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired',
    );
    expect(screen.queryByText('Confidential folder')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(resolvePublicLink).toHaveBeenCalled();
    });
  });

  it('hides the countdown when the public link is later revoked', async () => {
    setSearchParams({ token: 'share-token' });
    resolvePublicLink.mockResolvedValue(LINK);
    const { client } = renderWithProviders(<ShareScreen />);

    expect(await screen.findByText(/Expires in/)).toBeInTheDocument();

    resolvePublicLink.mockRejectedValue(
      apiError({ code: 'not_found', statusCode: 404 }),
    );
    await client.invalidateQueries({
      queryKey: accessQueryKeys.publicLink('share-token'),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired',
    );
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
  });

  it('hides the countdown as soon as access_invalidated arrives', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: () => undefined };
      },
    );
    setSearchParams({ token: 'share-token' });
    resolvePublicLink.mockResolvedValue(LINK);
    renderWithProviders(<ShareScreen />);

    expect(await screen.findByText(/Expires in/)).toBeInTheDocument();
    onEvent?.(revoked);
    await waitFor(() => {
      expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
    });
  });
});
