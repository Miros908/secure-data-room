import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { SESSION_COOKIE_NAME, TEST_PASSWORD } from './ports';

export const SAMPLE_PDF = path.join(process.cwd(), 'e2e/fixtures/sample.pdf');
export const SAMPLE_PDF_NAME = 'sample.pdf';

export function uniqueEmail() {
  return `pw-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

export async function registerAccount(
  page: Page,
  input?: { email?: string; password?: string; name?: string },
) {
  const email = input?.email ?? uniqueEmail();
  const password = input?.password ?? TEST_PASSWORD;
  const name = input?.name ?? 'E2E User';

  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/drive(\?|$)/);
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
  await expect(page.getByText('Folder is empty')).toBeVisible();

  return { email, password, name };
}

export async function loginAccount(
  page: Page,
  input: { email: string; password: string },
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(input.email);
  await page.getByLabel('Password', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/drive');
}

export async function openIncomingShare(page: Page, name: string) {
  await page.getByRole('link', { name: 'Shared with me' }).click();
  await expect(page.getByRole('heading', { name: 'Shared with me' })).toBeVisible();
  await page.getByRole('button', { name }).click();
}

export async function expectSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
  expect(session, 'session cookie must be set by the API').toBeTruthy();
  expect(session?.httpOnly).toBe(true);
}

export async function expectNoAuthInStorage(page: Page) {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((key) => /token|session|jwt/i.test(key))).toEqual([]);
}

export async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'New folder' }).click();
  const dialog = page.getByRole('dialog', { name: 'New folder' });
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('link', { name })).toBeVisible();
}

export async function uploadSamplePdf(page: Page) {
  const alreadyThere = await page
    .getByRole('link', { name: SAMPLE_PDF_NAME })
    .count();
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);

  if (alreadyThere === 0) {
    await expect(
      page.getByRole('link', { name: SAMPLE_PDF_NAME }),
    ).toBeVisible({ timeout: 20_000 });
    return;
  }

  await expect(page.getByText('New version uploaded')).toBeVisible({
    timeout: 20_000,
  });
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
}
