import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriveFolderFormDialog } from '@/app/(pages)/drive/components/drive-folder-form-dialog';
import { apiError } from '../api-error';
import { renderWithProviders } from '../render';

const createFolder = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/create-folder.poster', () => ({
  createFolder,
}));

const ROOM_ID = '33333333-3333-4333-8333-333333333333';

describe('DriveFolderFormDialog', () => {
  it('shows name_taken on the form', async () => {
    const user = userEvent.setup();
    createFolder.mockRejectedValueOnce(
      apiError({ code: 'name_taken', statusCode: 409 }),
    );
    renderWithProviders(
      <DriveFolderFormDialog
        mode="create"
        dataRoomId={ROOM_ID}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Финансы');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A folder with this name is already here',
    );
  });

  it('disables submit while the create request is pending', async () => {
    const user = userEvent.setup();
    createFolder.mockImplementationOnce(() => new Promise(() => undefined));
    renderWithProviders(
      <DriveFolderFormDialog
        mode="create"
        dataRoomId={ROOM_ID}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Финансы');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    });
  });
});
