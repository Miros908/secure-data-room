import { expect, test } from '@playwright/test';
import {
  registerAccount,
  uploadSamplePdf,
  SAMPLE_PDF_NAME,
} from './helpers';

test('public file link works without a session and does not offer upload', async ({
  page,
  browser,
}) => {
  await registerAccount(page);
  await uploadSamplePdf(page);

  await page.getByRole('button', { name: 'File actions' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();

  const urlInput = page.locator('input[readonly]');
  await expect(urlInput).toHaveValue(/\/share\?token=/);
  const shareUrl = await urlInput.inputValue();

  const guest = await browser.newContext();
  const sharePage = await guest.newPage();
  await sharePage.goto(shareUrl);

  await expect(sharePage.getByText(SAMPLE_PDF_NAME)).toBeVisible();
  await expect(
    sharePage.getByText('Viewing via link'),
  ).toBeVisible();
  await expect(sharePage.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(
    sharePage.getByRole('button', { name: 'Upload file' }),
  ).toHaveCount(0);
  await expect(sharePage.getByRole('button', { name: 'Create' })).toHaveCount(0);
  await expect(sharePage.getByRole('link', { name: 'My Drive' })).toHaveCount(0);

  await sharePage.getByRole('link', { name: SAMPLE_PDF_NAME }).click();
  await expect(sharePage.locator('iframe')).toBeVisible();

  await guest.close();
});
