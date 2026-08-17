import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '@/app/(pages)/register/components/register-form';
import { apiError, USER } from '../api-error';
import { routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const register = vi.hoisted(() => vi.fn());
const getMe = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/register.poster', () => ({
  register,
}));

vi.mock('@/app/api/get-me.fetcher', () => ({
  getMe,
}));

describe('RegisterForm', () => {
  it('shows client validation before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('replaces to /drive on success', async () => {
    const user = userEvent.setup();
    register.mockResolvedValueOnce(USER);
    getMe.mockResolvedValueOnce(USER);
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText('Name'), 'Owner');
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/drive');
    });
  });

  it('does not blame the cookie when register returns 200 without a session', async () => {
    const user = userEvent.setup();
    register.mockResolvedValueOnce(USER);
    getMe.mockRejectedValueOnce(
      apiError({ code: 'unauthorized', statusCode: 401 }),
    );
    renderWithProviders(<RegisterForm />);

    await user.type(screen.getByLabelText('Name'), 'Owner');
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText(
        "Couldn't start a session. If you already have an account, sign in.",
      ),
    ).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
