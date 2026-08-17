import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/app/(pages)/login/components/login-form';
import { apiError, USER } from '../api-error';
import { routerReplace } from '../navigation';
import { renderWithProviders } from '../render';

const login = vi.hoisted(() => vi.fn());
const getMe = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/login.poster', () => ({
  login,
}));

vi.mock('@/app/api/get-me.fetcher', () => ({
  getMe,
}));

describe('LoginForm', () => {
  it('shows client validation before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a login-specific unauthorized message', async () => {
    const user = userEvent.setup();
    login.mockRejectedValueOnce(apiError({ code: 'unauthorized', statusCode: 401 }));
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Wrong email or password');
    expect(getMe).not.toHaveBeenCalled();
  });

  it('explains when login succeeded but the session cookie was dropped', async () => {
    const user = userEvent.setup();
    login.mockResolvedValueOnce(USER);
    getMe.mockRejectedValueOnce(apiError({ code: 'unauthorized', statusCode: 401 }));
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser blocked the sign-in cookie',
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('disables submit while pending and replaces to /drive on success', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: typeof USER) => void = () => undefined;
    login.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();

    getMe.mockResolvedValueOnce(USER);
    resolveLogin(USER);
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith('/drive');
    });
  });
});
