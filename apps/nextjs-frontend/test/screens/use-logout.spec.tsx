import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLogout } from '@/app/hooks/mutations/use-logout';
import { authQueryKeys } from '@/app/lib/auth.query-keys';
import { USER } from '../api-error';
import { renderWithProviders } from '../render';

const logout = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/logout.poster', () => ({
  logout,
}));

function Probe() {
  const mutation = useLogout();
  return (
    <button type="button" onClick={() => mutation.mutate()}>
      Sign out
    </button>
  );
}

describe('useLogout', () => {
  it('clears the React Query cache after success', async () => {
    const user = userEvent.setup();
    logout.mockResolvedValueOnce({ ok: true as const });
    const { client } = renderWithProviders(<Probe />);
    client.setQueryData(authQueryKeys.me(), USER);
    expect(client.getQueryData(authQueryKeys.me())).toEqual(USER);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(client.getQueryCache().getAll()).toHaveLength(0);
    });
  });
});
