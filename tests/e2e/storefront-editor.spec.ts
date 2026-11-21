import { expect, test, type Page } from '@playwright/test';
import {
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  signIn,
  type TestStore,
} from './helpers';
import { deleteStoreMedia, hasR2, pngFile } from './media';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/storefront'));
  await page.locator('form[data-hydrated]').waitFor();
});

test.afterEach(async () => {
  if (hasR2) await deleteStoreMedia(shop.id);
  await deleteStore(shop);
});

const bar = (page: Page) => page.getByTestId('publish-bar');

async function saveDraft(page: Page) {
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByText('Draft saved. Preview it, then publish.'),
  ).toBeVisible();
}

/** The live store's home page, in a fresh tab. */
async function liveHome(page: Page) {
  const tab = await page.context().newPage();
  await tab.goto(storeUrl(shop.slug));
  return tab;
}

test('draft changes are previewed, then published', async ({ page }) => {
  await expect(bar(page)).toContainText('Live');

  await page.getByLabel('Announcement bar').fill('Diwali sale: 20% off');
  await page.getByLabel('Tagline').fill('Silks for every celebration');
  await page.getByLabel('Heading font').selectOption('Lora');
  await page.getByLabel('Soft').check();

  // Unreadable text is flagged as it is typed, and clears once fixed.
  const text = page.getByRole('textbox', { name: 'Text', exact: true });
  await text.fill('#C8C2B8');
  await expect(page.getByTestId('warning-text')).toBeVisible();
  await text.fill('#1A1A1A');
  await expect(page.getByTestId('warning-text')).toHaveCount(0);

  // The sample shows the change before saving.
  await expect(page.getByTestId('theme-sample')).toContainText(
    'Diwali sale: 20% off',
  );

  await saveDraft(page);
  await expect(bar(page)).toContainText('Unpublished changes');

  // Shoppers do not see a draft.
  const before = await liveHome(page);
  await expect(
    before.getByText('Diwali sale: 20% off', { exact: true }),
  ).toHaveCount(0);
  await before.close();

  // The preview does, for the store's team.
  const preview = await page.context().newPage();
  await preview.goto(app('/preview'));
  await expect(preview.getByTestId('preview-bar')).toContainText(
    'Shoppers do not see these changes until you publish.',
  );
  await expect(
    preview.getByText('Diwali sale: 20% off', { exact: true }),
  ).toBeVisible();
  await preview.close();

  // Publish: the store changes at once.
  await bar(page).getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByText('Published. Your store is updated.'),
  ).toBeVisible();
  await expect(bar(page)).toContainText('Live');
  const after = await liveHome(page);
  await expect(
    after.getByText('Diwali sale: 20% off', { exact: true }),
  ).toBeVisible();
  await expect(
    after.getByText('Silks for every celebration', { exact: true }),
  ).toBeVisible();
  await after.close();

  // A later change can be thrown away.
  await page.getByLabel('Announcement bar').fill('Not this one');
  await saveDraft(page);
  await expect(bar(page)).toContainText('Unpublished changes');
  await bar(page).getByRole('button', { name: 'Discard changes' }).click();
  await page
    .getByRole('alertdialog', { name: 'Discard unpublished changes?' })
    .getByRole('button', { name: 'Discard' })
    .click();
  await expect(bar(page)).toContainText('Live');
  await page.locator('form[data-hydrated]').waitFor();
  await expect(page.getByLabel('Announcement bar')).toHaveValue(
    'Diwali sale: 20% off',
  );
});

test('a logo replaces the store name in the header', async ({ page }) => {
  test.skip(!hasR2, 'Needs R2 keys (R2_* in .env.local)');
  await page
    .getByLabel('Upload logo')
    .setInputFiles(pngFile('logo.png', [120, 30, 50], 320, 80));
  await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
  await saveDraft(page);
  await bar(page).getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByText('Published. Your store is updated.'),
  ).toBeVisible();

  const home = await liveHome(page);
  await expect(
    home.getByRole('link', { name: `${shop.name} home` }).getByRole('img'),
  ).toBeVisible();
  await home.close();
});
