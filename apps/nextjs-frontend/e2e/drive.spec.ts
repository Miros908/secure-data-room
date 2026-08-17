import { expect, test } from '@playwright/test';
import { createFolder, registerAccount, uploadSamplePdf, SAMPLE_PDF_NAME } from './helpers';

test('creating a folder opens it by id', async ({ page }) => {
  await registerAccount(page);
  await createFolder(page, 'Финансы');
  await page.getByRole('link', { name: 'Финансы' }).click();

  await expect(page).toHaveURL(/folderId=/);
  await expect(page.getByRole('heading', { name: 'Финансы' })).toBeVisible();
  await expect(page.getByText('Folder is empty')).toBeVisible();
});

test('uploading a PDF opens the viewer iframe', async ({ page }) => {
  await registerAccount(page);
  await uploadSamplePdf(page);
  await page.getByRole('link', { name: SAMPLE_PDF_NAME }).click();

  await expect(page).toHaveURL(/fileId=/);
  await expect(page.locator('iframe')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

  await page.goBack();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page).not.toHaveURL(/fileId=/);
  await expect(page.getByRole('link', { name: SAMPLE_PDF_NAME })).toBeVisible();
});

test('re-uploading the same PDF adds a version, not a second row', async ({
  page,
}) => {
  await registerAccount(page);
  await uploadSamplePdf(page);
  await uploadSamplePdf(page);

  await expect(page.getByRole('link', { name: SAMPLE_PDF_NAME })).toHaveCount(
    1,
  );
  await expect(page.getByText('2 ver.')).toBeVisible();
  await expect(page.getByText('New version uploaded')).toBeVisible();

  await page.getByRole('link', { name: SAMPLE_PDF_NAME }).click();
  await expect(page.getByLabel('File version')).toBeVisible();
  await page.getByLabel('File version').click();
  await expect(page.getByRole('option', { name: /Version 1/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /Version 2/ })).toBeVisible();
});

test('deleted folder URL shows a safe error and returns to the drive', async ({
  page,
}) => {
  await registerAccount(page);
  await createFolder(page, 'Архив');
  const folderHref = await page.getByRole('link', { name: 'Архив' }).getAttribute('href');
  expect(folderHref).toContain('folderId=');

  await page.getByRole('button', { name: 'Folder actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: 'Архив' })).toHaveCount(0);

  await page.goto(folderHref ?? '/drive');
  await expect(page.getByText('Folder not found')).toBeVisible();
  await page.getByRole('button', { name: 'My Drive' }).click();
  await expect(page).toHaveURL(/\/drive/);
  await expect(page).not.toHaveURL(/folderId=/);
});
