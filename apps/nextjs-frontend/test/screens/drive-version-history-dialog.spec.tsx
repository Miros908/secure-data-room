import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveVersionHistoryDialog } from '@/app/(pages)/drive/components/drive-version-history-dialog';
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

describe('DriveVersionHistoryDialog', () => {
  beforeEach(() => {
    listFileVersions.mockReset();
    listFileVersions.mockResolvedValue({
      versions: [VERSION_TWO, VERSION_ONE],
    });
  });

  it('shows the list without opening a preview until Open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenVersion = vi.fn();

    renderWithProviders(
      <DriveVersionHistoryDialog
        fileId={FILE_DETAIL.id}
        fileName={FILE_DETAIL.name}
        onClose={onClose}
        onOpenVersion={onOpenVersion}
      />,
    );

    expect(await screen.findByText('Version 2')).toBeTruthy();
    expect(screen.getByText('Version 1')).toBeTruthy();
    expect(onOpenVersion).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open version 1' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(onOpenVersion).toHaveBeenCalledWith(VERSION_ONE.id);
    });
  });
});
