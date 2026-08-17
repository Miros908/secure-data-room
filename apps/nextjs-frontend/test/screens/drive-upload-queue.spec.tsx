import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriveUploadQueue } from '@/app/(pages)/drive/components/drive-upload-queue';
import { renderWithProviders } from '../render';

describe('DriveUploadQueue', () => {
  it('shows per-file progress and dismisses errors without retry', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderWithProviders(
      <DriveUploadQueue
        items={[
          { id: '1', name: 'ok.pdf', status: 'uploading', progress: 40 },
          {
            id: '2',
            name: 'bad.pdf',
            status: 'error',
            progress: 0,
            errorMessage: 'This file type is not supported',
          },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Uploading ok.pdf' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByText('This file type is not supported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('2');
  });
});
