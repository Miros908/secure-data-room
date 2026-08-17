import { expect, test } from '@playwright/test';
import {
  expectNoAuthInStorage,
  expectSessionCookie,
  loginAccount,
  logout,
  registerAccount,
} from './helpers';

test('register stores an httpOnly session cookie and survives reload', async ({
  page,
}) => {
  await registerAccount(page);
  await expectSessionCookie(page);
  await expectNoAuthInStorage(page);

  await page.reload();
  await expect(page).toHaveURL(/\/drive/);
  await expect(page.getByText('Folder is empty')).toBeVisible();
  await expectSessionCookie(page);
});

test('login and register send an existing session to drive', async ({
  page,
}) => {
  await registerAccount(page);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/drive/);
  await expect(page.getByText('Folder is empty')).toBeVisible();

  await page.goto('/register');
  await expect(page).toHaveURL(/\/drive/);
});

test('logout clears the disk and login restores it', async ({ page }) => {
  const account = await registerAccount(page);
  await logout(page);

  await page.goto('/drive');
  await expect(page).toHaveURL(/\/login/);

  await loginAccount(page, account);
  await expect(page.getByText('Folder is empty')).toBeVisible();
  await expectSessionCookie(page);
});
