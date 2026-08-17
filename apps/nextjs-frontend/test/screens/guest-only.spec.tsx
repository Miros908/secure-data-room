import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestOnly } from '@/app/components/guest-only';
import { apiError, USER } from '../api-error';
import { routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const meState = vi.hoisted(() => ({
  current: {
    isPending: false,
    isSuccess: false,
    error: null as ReturnType<typeof apiError> | null,
    data: undefined as typeof USER | undefined,
  },
}));

vi.mock('@/app/hooks/queries/use-me', () => ({
  useMe: () => meState.current,
}));

describe('GuestOnly', () => {
  beforeEach(() => {
    meState.current = {
      isPending: false,
      isSuccess: false,
      error: null,
      data: undefined,
    };
  });

  it('hides children while the session check is pending', () => {
    meState.current.isPending = true;
    renderWithProviders(
      <GuestOnly>
        <button type="button">Войти</button>
      </GuestOnly>,
    );

    expect(screen.queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('renders children when there is no session', () => {
    meState.current.error = apiError({ code: 'unauthorized', statusCode: 401 });
    renderWithProviders(
      <GuestOnly>
        <button type="button">Войти</button>
      </GuestOnly>,
    );

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('does not bounce to /drive when a stale profile sits next to a 401', () => {
    meState.current.data = USER;
    meState.current.isSuccess = false;
    meState.current.error = apiError({ code: 'unauthorized', statusCode: 401 });
    renderWithProviders(
      <GuestOnly>
        <button type="button">Войти</button>
      </GuestOnly>,
    );

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('redirects to /drive when the session is valid', async () => {
    meState.current.data = USER;
    meState.current.isSuccess = true;
    renderWithProviders(
      <GuestOnly>
        <button type="button">Войти</button>
      </GuestOnly>,
    );

    expect(screen.queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/drive');
    });
  });
});
