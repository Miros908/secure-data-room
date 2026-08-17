import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveScreen } from '@/app/(pages)/drive/components/drive-screen';
import { apiError, USER } from '../api-error';
import { routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const meState = vi.hoisted(() => ({
  current: {
    isPending: false,
    error: null as ReturnType<typeof apiError> | null,
    data: undefined as typeof USER | undefined,
    refetch: vi.fn(),
  },
}));

vi.mock('@/app/hooks/queries/use-me', () => ({
  useMe: () => meState.current,
}));

vi.mock('@/app/(pages)/drive/components/drive-shell', () => ({
  DriveShell: () => <div>drive-shell</div>,
}));

describe('DriveScreen', () => {
  beforeEach(() => {
    meState.current = {
      isPending: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    };
  });

  it('redirects to /login on 401', async () => {
    meState.current.error = apiError({ code: 'unauthorized', statusCode: 401 });
    renderWithProviders(<DriveScreen />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows retry when the profile request fails', async () => {
    meState.current.error = apiError({ code: 'internal_error', statusCode: 500 });
    renderWithProviders(<DriveScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't complete the request. Try again",
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the shell when the session is valid', async () => {
    meState.current.data = USER;
    renderWithProviders(<DriveScreen />);

    expect(await screen.findByText('drive-shell')).toBeInTheDocument();
  });
});
