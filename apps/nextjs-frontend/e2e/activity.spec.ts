import { expect, test } from '@playwright/test';
import {
  registerAccount,
  uploadSamplePdf,
  SAMPLE_PDF_NAME,
} from './helpers';

test('activity screen shows a guest after a public view', async ({
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
  const viewed = sharePage.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        url.pathname.endsWith('/view') &&
        response.ok()
      );
    } catch {
      return false;
    }
  });
  await sharePage.goto(shareUrl);
  await sharePage.getByRole('link', { name: SAMPLE_PDF_NAME }).click();
  await expect(sharePage.locator('iframe')).toBeVisible();
  await viewed;
  await guest.close();

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page).toHaveURL(/view=activity/);
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Link visitor/ }),
  ).toBeVisible();
  await expect(page.getByText(`View · ${SAMPLE_PDF_NAME}`)).toHaveCount(1);
});
