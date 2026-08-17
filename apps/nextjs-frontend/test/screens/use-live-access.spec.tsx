import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAccessGate } from '@/app/hooks/use-live-access';
import { useLiveNotice } from '@/app/hooks/use-live-notice';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { createTestQueryClient, renderWithProviders } from '../render';
import type { LiveEvent } from '@sdr/shared/events';

const connectLiveEvents = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/connect-live-events', () => ({
  connectLiveEvents,
}));

const ROOM = '11111111-1111-4111-8111-111111111111';
const OTHER_ROOM = '33333333-3333-4333-8333-333333333333';
const FILE = '22222222-2222-4222-8222-222222222222';

const revoked: LiveEvent = {
  type: 'access_invalidated',
  reason: 'revoked',
  dataRoomId: ROOM,
  target: { kind: 'file', id: FILE },
};

function NoticeProbe() {
  const notice = useLiveNotice();
  return <span>{notice?.type ?? 'none'}</span>;
}

describe('LiveAccessGate', () => {
  beforeEach(() => {
    connectLiveEvents.mockReset();
    connectLiveEvents.mockReturnValue({ close: vi.fn() });
  });

  it('does not open a stream without a room or token', () => {
    renderWithProviders(<LiveAccessGate fileId={FILE}>idle</LiveAccessGate>);
    expect(connectLiveEvents).not.toHaveBeenCalled();
  });

  it('closes the stream on unmount', () => {
    const close = vi.fn();
    connectLiveEvents.mockReturnValue({ close });

    const { unmount } = renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM}>ok</LiveAccessGate>,
    );

    expect(connectLiveEvents).toHaveBeenCalled();
    unmount();
    expect(close).toHaveBeenCalled();
  });

  it('stores a live event as the notice', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM} fileId={FILE}>
        <NoticeProbe />
      </LiveAccessGate>,
    );

    expect(screen.getByText('none')).toBeInTheDocument();
    onEvent?.(revoked);
    await waitFor(() => {
      expect(screen.getByText('access_invalidated')).toBeInTheDocument();
    });
  });

  it('does not show a notice for another data room', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM}>
        <NoticeProbe />
      </LiveAccessGate>,
    );

    onEvent?.({
      ...revoked,
      dataRoomId: OTHER_ROOM,
    });

    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('refreshes share lists when access changes in another room', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    const client = createTestQueryClient();
    client.setQueryData(accessQueryKeys.incoming(), {
      rooms: [],
      folders: [],
      files: [],
    });

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM}>
        <NoticeProbe />
      </LiveAccessGate>,
      { client },
    );

    onEvent?.({
      ...revoked,
      dataRoomId: OTHER_ROOM,
    });

    expect(screen.getByText('none')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        client.getQueryState(accessQueryKeys.incoming())?.isInvalidated,
      ).toBe(true);
    });

    client.setQueryData(accessQueryKeys.incoming(), {
      rooms: [],
      folders: [],
      files: [],
    });

    onEvent?.({
      type: 'access_granted',
      dataRoomId: OTHER_ROOM,
      target: { kind: 'file', id: FILE },
    });

    await waitFor(() => {
      expect(
        client.getQueryState(accessQueryKeys.incoming())?.isInvalidated,
      ).toBe(true);
    });
  });

  it('keeps a revoke for the open file even if the room id is stale', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM} fileId={FILE}>
        <NoticeProbe />
      </LiveAccessGate>,
    );

    onEvent?.({
      ...revoked,
      dataRoomId: OTHER_ROOM,
    });

    await waitFor(() => {
      expect(screen.getByText('access_invalidated')).toBeInTheDocument();
    });
  });

  it('does not reconnect when only the open file changes', () => {
    const close = vi.fn();
    connectLiveEvents.mockReturnValue({ close });

    const { rerender } = renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM}>ok</LiveAccessGate>,
    );

    expect(connectLiveEvents).toHaveBeenCalledTimes(1);

    rerender(
      <LiveAccessGate dataRoomId={ROOM} fileId={FILE}>
        ok
      </LiveAccessGate>,
    );

    expect(connectLiveEvents).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('does not treat activity_recorded as an access notice', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM}>
        <NoticeProbe />
      </LiveAccessGate>,
    );

    onEvent?.({ type: 'activity_recorded', dataRoomId: ROOM });
    await waitFor(() => {
      expect(screen.getByText('none')).toBeInTheDocument();
    });
  });

  it('refreshes on access_granted without showing a revoke notice', async () => {
    let onEvent: ((event: LiveEvent) => void) | undefined;
    connectLiveEvents.mockImplementation(
      (options: { onEvent: (event: LiveEvent) => void }) => {
        onEvent = options.onEvent;
        return { close: vi.fn() };
      },
    );

    renderWithProviders(
      <LiveAccessGate dataRoomId={ROOM} fileId={FILE}>
        <NoticeProbe />
      </LiveAccessGate>,
    );

    onEvent?.(revoked);
    await waitFor(() => {
      expect(screen.getByText('access_invalidated')).toBeInTheDocument();
    });

    onEvent?.({
      type: 'access_granted',
      dataRoomId: ROOM,
      target: { kind: 'file', id: FILE },
    });
    await waitFor(() => {
      expect(screen.getByText('none')).toBeInTheDocument();
    });
  });
});
