import { expect, test, type Page } from '@playwright/test';
import {
  createFolder,
  loginAccount,
  openIncomingShare,
  registerAccount,
  uniqueEmail,
  uploadSamplePdf,
  SAMPLE_PDF_NAME,
} from './helpers';

test('viewer PDF closes when the owner revokes access', async ({
  page,
  browser,
}) => {
  const viewerEmail = uniqueEmail();
  const viewerPassword = 'TestPass-12';
  await registerAccount(page, {
    email: viewerEmail,
    password: viewerPassword,
    name: 'Viewer',
  });
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await registerAccount(ownerPage, { name: 'Owner' });
  await uploadSamplePdf(ownerPage);
  await shareWithEmail(ownerPage, viewerEmail);

  await loginAccount(page, { email: viewerEmail, password: viewerPassword });
  const live = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      const pageRoom = new URL(page.url()).searchParams.get('dataRoomId');
      return (
        url.pathname === '/events' &&
        response.ok() &&
        Boolean(pageRoom) &&
        url.searchParams.get('dataRoomId') === pageRoom
      );
    } catch {
      return false;
    }
  });
  await openIncomingShare(page, SAMPLE_PDF_NAME);
  await live;
  await expect(page.locator('iframe')).toBeVisible();

  await ownerPage.getByRole('button', { name: 'Remove' }).click();
  await expect(
    ownerPage.getByRole('dialog').getByText('Only you have access'),
  ).toBeVisible();

  await expect(
    page.getByText('You no longer have access to this file'),
  ).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);

  await owner.close();
});

test('shared folder closes when the owner deletes it', async ({
  page,
  browser,
}) => {
  const viewerEmail = uniqueEmail();
  const viewerPassword = 'TestPass-12';
  await registerAccount(page, {
    email: viewerEmail,
    password: viewerPassword,
    name: 'Viewer',
  });
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await registerAccount(ownerPage, { name: 'Owner' });
  await createFolder(ownerPage, 'Секретная');
  await ownerPage.getByRole('button', { name: 'Folder actions' }).click();
  await ownerPage.getByRole('menuitem', { name: 'Share' }).click();
  await ownerPage.getByLabel('Email').fill(viewerEmail);
  await ownerPage.getByRole('button', { name: 'Add' }).click();
  await expect(
    ownerPage.getByRole('dialog').getByText(viewerEmail),
  ).toBeVisible();
  await ownerPage.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await loginAccount(page, { email: viewerEmail, password: viewerPassword });
  await openIncomingShare(page, 'Секретная');
  await expect(page.getByRole('heading', { name: 'Секретная' })).toBeVisible();

  await ownerPage.getByRole('button', { name: 'Folder actions' }).click();
  await ownerPage.getByRole('menuitem', { name: 'Delete' }).click();
  await ownerPage
    .locator('[role="dialog"]')
    .last()
    .locator('button', { hasText: /^Delete$/ })
    .click();

  await expect(page.getByText('This folder was deleted or is unavailable')).toBeVisible();

  await owner.close();
});

test('public PDF closes when the owner turns the link off', async ({
  page,
  browser,
}) => {
  await registerAccount(page);
  await uploadSamplePdf(page);

  await page.getByRole('button', { name: 'File actions' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const shareUrl = await page.locator('input[readonly]').inputValue();
  await expect(page.getByRole('button', { name: 'Turn off link' })).toBeVisible();

  const guest = await browser.newContext();
  const sharePage = await guest.newPage();
  await sharePage.goto(shareUrl);
  await sharePage.getByRole('link', { name: SAMPLE_PDF_NAME }).click();
  await expect(sharePage.locator('iframe')).toBeVisible();

  await page.getByRole('button', { name: 'Turn off link' }).click();
  await expect(page.getByRole('button', { name: 'Create link' })).toBeVisible();

  await expect(sharePage.getByText("This link isn't available")).toBeVisible();

  await guest.close();
});

async function shareWithEmail(page: Page, email: string) {
  await page.getByRole('button', { name: 'File actions' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('dialog').getByText(email)).toBeVisible();
}
