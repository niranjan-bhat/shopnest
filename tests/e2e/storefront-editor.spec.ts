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
const status = (page: Page) => page.getByTestId('publish-status');

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
  await expect(status(page)).toContainText('Live');

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
  await expect(status(page)).toContainText('Unpublished changes');

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
  await expect(status(page)).toContainText('Live');
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
  await expect(status(page)).toContainText('Unpublished changes');
  await bar(page).getByRole('button', { name: 'Discard changes' }).click();
  await page
    .getByRole('alertdialog', { name: 'Discard unpublished changes?' })
    .getByRole('button', { name: 'Discard' })
    .click();
  await expect(status(page)).toContainText('Live');
  await page.locator('form[data-hydrated]').waitFor();
  await expect(page.getByLabel('Announcement bar')).toHaveValue(
    'Diwali sale: 20% off',
  );
});

/** The step the publishing track is on: Edit, Draft or Live. */
const step = (page: Page) => bar(page).locator('[aria-current="step"]');

test('unsaved edits can be undone; the track follows each step', async ({
  page,
}) => {
  const publish = bar(page).getByRole('button', { name: 'Publish' });
  const brand = page.getByRole('textbox', {
    name: 'Brand colour',
    exact: true,
  });
  const before = await brand.inputValue();
  const tagline = page.getByLabel('Tagline');
  const taglineBefore = await tagline.inputValue();
  await expect(step(page)).toContainText('Live');
  await expect(page.getByRole('button', { name: 'Undo edits' })).toHaveCount(0);

  // The bar stays in reach while scrolling, with a shadow only once pinned.
  await expect(bar(page)).not.toHaveAttribute('data-stuck');
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(bar(page)).toHaveAttribute('data-stuck', 'true');
  await expect(bar(page)).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar(page)).not.toHaveAttribute('data-stuck');

  // An edit not yet saved: Publish waits, and the edit can be undone.
  await brand.fill('#123456');
  await tagline.fill('Not this either');
  await expect(step(page)).toContainText('Edit');
  await expect(status(page)).toContainText('Unsaved edits');
  await expect(publish).toBeDisabled();
  await page.getByRole('button', { name: 'Undo edits' }).click();
  await expect(brand).toHaveValue(before);
  await expect(tagline).toHaveValue(taglineBefore);
  await expect(step(page)).toContainText('Live');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();

  // Saved to the draft: waiting to publish. Undo goes back to the draft.
  await brand.fill('#123456');
  await saveDraft(page);
  await expect(step(page)).toContainText('Draft');
  await expect(status(page)).toContainText('Unpublished changes');
  await expect(publish).toBeEnabled();
  await brand.fill('#654321');
  await page.getByRole('button', { name: 'Undo edits' }).click();
  await expect(brand).toHaveValue('#123456');
  await expect(step(page)).toContainText('Draft');

  await publish.click();
  await expect(
    page.getByText('Published. Your store is updated.'),
  ).toBeVisible();
  await expect(step(page)).toContainText('Live');
});

test('a logo replaces the store name, sized to its shape', async ({ page }) => {
  test.skip(!hasR2, 'Needs R2 keys (R2_* in .env.local)');
  const upload = page.getByLabel('Upload logo');

  // Too wide to read: refused before anything is uploaded.
  await upload.setInputFiles(pngFile('thin.png', [120, 30, 50], 1800, 200));
  await expect(page.getByText(/too wide to read in the header/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove logo' })).toHaveCount(
    0,
  );

  // A 6:1 logo uses the header's full logo width.
  await upload.setInputFiles(pngFile('logo.png', [120, 30, 50], 1200, 200));
  await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
  await saveDraft(page);
  await bar(page).getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByText('Published. Your store is updated.'),
  ).toBeVisible();

  const home = await liveHome(page);
  const logo = home
    .getByRole('link', { name: `${shop.name} home` })
    .getByRole('img');
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  const wide = (home.viewportSize()?.width ?? 0) >= 768;
  // 300 Ã— 50 from md up, 180 Ã— 30 on phones (it was 240 Ã— 40 everywhere).
  expect(box?.width).toBeCloseTo(wide ? 300 : 180, 0);
  expect(box?.height).toBeCloseTo(wide ? 50 : 30, 0);
  await home.close();
});
