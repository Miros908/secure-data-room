import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveDetailsPanel } from '@/app/(pages)/drive/components/drive-details-panel';
import { FILE_DETAIL } from '../api-error';
import { renderWithProviders } from '../render';

const listFileVersions = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/list-file-versions.fetcher', () => ({
  listFileVersions,
}));

const VERSION_ONE = {
  id: '55555555-5555-4555-8555-555555555555',
  versionNumber: 1,
  sizeBytes: 512,
  createdAt: '2026-08-15T12:00:00.000Z',
  uploadedByName: 'Owner',
};

const VERSION_TWO = {
  id: FILE_DETAIL.currentVersionId,
  versionNumber: 2,
  sizeBytes: 1024,
  createdAt: FILE_DETAIL.createdAt,
  uploadedByName: 'Owner',
};

describe('DriveDetailsPanel versions', () => {
  beforeEach(() => {
    listFileVersions.mockReset();
    listFileVersions.mockResolvedValue({
      versions: [VERSION_TWO, VERSION_ONE],
    });
  });

  it('does not fetch history for a single-version file', () => {
    renderWithProviders(
      <DriveDetailsPanel
        subject={{
          kind: 'file',
          id: FILE_DETAIL.id,
          name: FILE_DETAIL.name,
          createdAt: FILE_DETAIL.createdAt,
          sizeBytes: FILE_DETAIL.sizeBytes,
          versionCount: 1,
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Version history')).toBeNull();
    expect(listFileVersions).not.toHaveBeenCalled();
  });

  it('lists versions; preview opens only via Open', async () => {
    const user = userEvent.setup();
    const onOpenVersion = vi.fn();

    renderWithProviders(
      <DriveDetailsPanel
        subject={{
          kind: 'file',
          id: FILE_DETAIL.id,
          name: FILE_DETAIL.name,
          createdAt: FILE_DETAIL.createdAt,
          sizeBytes: FILE_DETAIL.sizeBytes,
          versionCount: 2,
        }}
        onClose={vi.fn()}
        onOpenVersion={onOpenVersion}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Open version 1' })).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open version 1' }));

    await waitFor(() => {
      expect(onOpenVersion).toHaveBeenCalledWith(FILE_DETAIL.id, VERSION_ONE.id);
    });
  });
});
