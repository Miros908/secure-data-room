import { GUEST_ACTIVITY_NAME } from '@sdr/shared/activity';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveActivityView } from '@/app/(pages)/drive/components/drive-activity-view';
import { FILE_DETAIL } from '../api-error';
import { renderWithProviders } from '../render';

const getActivitySummary = vi.hoisted(() => vi.fn());
const getActivityTimeline = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/get-activity-summary.fetcher', () => ({
  getActivitySummary,
}));

vi.mock('@/app/api/get-activity-timeline.fetcher', () => ({
  getActivityTimeline,
}));

const GUEST_KEY = 'link:55555555-5555-4555-8555-555555555555';

describe('DriveActivityView', () => {
  beforeEach(() => {
    getActivitySummary.mockReset();
    getActivityTimeline.mockReset();
    getActivitySummary.mockResolvedValue({
      visitors: [],
      topFiles: [],
      totals: { views: 0, downloads: 0, uniqueVisitors: 0, linkOpens: 0 },
    });
    getActivityTimeline.mockResolvedValue({ events: [], nextCursor: null });
  });

  it('shows an empty state when nobody opened documents', async () => {
    renderWithProviders(<DriveActivityView roomId={FILE_DETAIL.dataRoomId} />);

    expect(
      await screen.findByText('No activity yet'),
    ).toBeInTheDocument();
  });

  it('lists a public-link guest and filters the timeline on click', async () => {
    const user = userEvent.setup();
    getActivitySummary.mockResolvedValue({
      visitors: [
        {
          actor: {
            key: GUEST_KEY,
            kind: 'guest',
            name: GUEST_ACTIVITY_NAME,
            email: null,
          },
          viewCount: 1,
          downloadCount: 0,
          lastSeenAt: '2026-08-16T12:00:00.000Z',
          firstSeenAt: '2026-08-16T12:00:00.000Z',
        },
      ],
      topFiles: [
        {
          fileId: FILE_DETAIL.id,
          name: FILE_DETAIL.name,
          viewCount: 1,
          downloadCount: 0,
          lastViewedAt: '2026-08-16T12:00:00.000Z',
        },
      ],
      totals: { views: 1, downloads: 0, uniqueVisitors: 1, linkOpens: 1 },
    });
    getActivityTimeline.mockResolvedValue({
      events: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          type: 'file_viewed',
          createdAt: '2026-08-16T12:00:00.000Z',
          actor: {
            key: GUEST_KEY,
            kind: 'guest',
            name: GUEST_ACTIVITY_NAME,
            email: null,
          },
          fileId: FILE_DETAIL.id,
          folderId: null,
          resourceName: FILE_DETAIL.name,
          metadata: null,
        },
      ],
      nextCursor: null,
    });

    renderWithProviders(<DriveActivityView roomId={FILE_DETAIL.dataRoomId} />);

    expect(
      await screen.findByRole('button', { name: /Link visitor/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(FILE_DETAIL.name)).toBeInTheDocument();
    expect(screen.getByText(/View/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Link visitor/ }));

    await waitFor(() => {
      expect(getActivityTimeline).toHaveBeenCalledWith(
        FILE_DETAIL.dataRoomId,
        expect.objectContaining({ actorKey: GUEST_KEY }),
      );
    });
  });
});
