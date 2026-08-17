import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveIncomingView } from '@/app/(pages)/drive/components/drive-incoming-view';
import { FILE_DETAIL, apiError } from '../api-error';
import { routerPush } from '../navigation';
import { renderWithProviders } from '../render';

const listIncomingShares = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/list-incoming-shares.fetcher', () => ({
  listIncomingShares,
}));

const SHARED_ROOM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FOLDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MY_ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('DriveIncomingView', () => {
  beforeEach(() => {
    listIncomingShares.mockReset();
    listIncomingShares.mockResolvedValue({
      rooms: [],
      folders: [],
      files: [],
    });
  });

  it('shows an empty state when nothing is shared', async () => {
    renderWithProviders(<DriveIncomingView myRoomId={MY_ROOM_ID} />);

    expect(
      await screen.findByText('Files shared with you will show up here'),
    ).toBeInTheDocument();
  });

  it('lists incoming shares and opens a file', async () => {
    const user = userEvent.setup();
    listIncomingShares.mockResolvedValue({
      rooms: [
        {
          id: SHARED_ROOM_ID,
          name: 'Acme',
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
      folders: [
        {
          id: FOLDER_ID,
          name: 'Legal',
          dataRoomId: SHARED_ROOM_ID,
          role: 'editor',
          accessExpiresAt: null,
        },
      ],
      files: [
        {
          id: FILE_DETAIL.id,
          name: FILE_DETAIL.name,
          dataRoomId: SHARED_ROOM_ID,
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
    });

    renderWithProviders(<DriveIncomingView myRoomId={MY_ROOM_ID} />);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText(FILE_DETAIL.name)).toBeInTheDocument();
    expect(screen.getByText('Folder · Editor')).toBeInTheDocument();

    await user.click(screen.getByText(FILE_DETAIL.name));

    expect(routerPush).toHaveBeenCalledWith(
      `/drive?fileId=${FILE_DETAIL.id}&dataRoomId=${SHARED_ROOM_ID}`,
    );
  });

  it('filters the list by type', async () => {
    const user = userEvent.setup();
    listIncomingShares.mockResolvedValue({
      rooms: [],
      folders: [
        {
          id: FOLDER_ID,
          name: 'Legal',
          dataRoomId: SHARED_ROOM_ID,
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
      files: [
        {
          id: FILE_DETAIL.id,
          name: FILE_DETAIL.name,
          dataRoomId: SHARED_ROOM_ID,
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
    });

    renderWithProviders(<DriveIncomingView myRoomId={MY_ROOM_ID} />);
    expect(await screen.findByText('Legal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Files' }));

    expect(screen.queryByText('Legal')).not.toBeInTheDocument();
    expect(screen.getByText(FILE_DETAIL.name)).toBeInTheDocument();
  });

  it('hides items that do not match search', async () => {
    listIncomingShares.mockResolvedValue({
      rooms: [],
      folders: [
        {
          id: FOLDER_ID,
          name: 'Legal',
          dataRoomId: SHARED_ROOM_ID,
          role: 'viewer',
          accessExpiresAt: null,
        },
      ],
      files: [],
    });

    renderWithProviders(
      <DriveIncomingView myRoomId={MY_ROOM_ID} search="nda" />,
    );

    expect(await screen.findByText('No results found')).toBeInTheDocument();
  });

  it('shows retry when the request fails', async () => {
    const user = userEvent.setup();
    listIncomingShares.mockRejectedValueOnce(
      apiError({ code: 'internal_error', statusCode: 500 }),
    );

    renderWithProviders(<DriveIncomingView myRoomId={MY_ROOM_ID} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    listIncomingShares.mockResolvedValue({
      rooms: [],
      folders: [],
      files: [],
    });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(
        screen.getByText('Files shared with you will show up here'),
      ).toBeInTheDocument();
    });
  });
});
