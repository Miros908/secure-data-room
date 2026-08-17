import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { HomePage } from '@/app/components/home-page';
import { useLocaleStore } from '@/store/locale.store';
import { renderWithProviders } from '../render';

describe('locale switcher', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: 'en' });
  });

  it('switches UI copy between locales', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(
      0,
    );

    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(screen.getByRole('menuitem', { name: 'Русский' }));

    expect(screen.getAllByRole('link', { name: 'Войти' }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Язык' }));
    await user.click(screen.getByRole('menuitem', { name: 'Українська' }));

    expect(screen.getAllByRole('link', { name: 'Увійти' }).length).toBeGreaterThan(0);
  });
});
