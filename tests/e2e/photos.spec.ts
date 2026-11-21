import { expect, test, type Page } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  signIn,
  type TestStore,
} from './helpers';
import { deleteStoreMedia, hasR2, pngFile, storeMediaKeys } from './media';
import { app, store as storeUrl } from './urls';

// Uploads real files to the R2 bucket in .env.local (removed afterwards).
test.skip(!hasR2, 'Needs R2 keys (R2_* in .env.local)');

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  await createProducts(shop, 1);
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
});

test.afterEach(async () => {
  await deleteStoreMedia(shop.id);
  await deleteStore(shop);
});

/** Waits for the screen-reader announcement, re-pressing a lost key. */
async function moveLeftTo(page: Page, position: string) {
  const announcer = page.locator('[id^="DndLiveRegion"]').filter({
    hasText: /./,
  });
  await expect(async () => {
    const text = (await announcer.last().textContent()) ?? '';
    if (!text.includes(position)) await page.keyboard.press('ArrowLeft');
    await expect(announcer.last()).toContainText(position, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test('a merchant uploads, orders, describes and deletes photos', async ({
  page,
}) => {
  await page.goto(app('/dashboard/products'));
  await page.getByRole('link', { name: /Product 01/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Product 01' }),
  ).toBeVisible();
  const tiles = page.getByTestId('photo-tile').filter({ visible: true });
  await expect(tiles).toHaveCount(0);

  // Three photos at once; they are resized and uploaded straight to R2.
  await page
    .getByLabel('Add photos')
    .setInputFiles([
      pngFile('red.png', [200, 30, 30]),
      pngFile('green.png', [30, 160, 60]),
      pngFile('blue.png', [30, 60, 200]),
    ]);
  await expect(page.getByText('3 photos added')).toBeVisible();
  await expect(tiles).toHaveCount(3);
  await expect(tiles.first()).toContainText('Cover');
  const keys = await storeMediaKeys(shop.id);
  expect(keys).toHaveLength(3);
  expect(keys.every((k) => /\.(webp|jpg)$/.test(k))).toBe(true);

  // Make photo 3 the cover with the keyboard.
  const srcOf = async (n: number) =>
    (await tiles.nth(n).locator('img').getAttribute('src')) ?? '';
  const third = await srcOf(2);
  await page.getByRole('button', { name: 'Move photo 3' }).focus();
  await page.keyboard.press('Space');
  await moveLeftTo(page, 'position 2 of 3');
  await moveLeftTo(page, 'position 1 of 3');
  await page.keyboard.press('Space');
  await expect.poll(() => srcOf(0)).toBe(third);
  await expect(tiles.first()).toContainText('Cover');

  // Describe the new cover.
  await page.getByRole('button', { name: 'Describe photo 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Describe this photo' });
  await dialog.getByLabel('Photo description').fill('Blue kurta, front');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(tiles.first().locator('img')).toHaveAttribute(
    'alt',
    'Blue kurta, front',
  );

  // Delete photo 2: it leaves the product and the bucket.
  await page.getByRole('button', { name: 'Delete photo 2' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete photo 2?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(tiles).toHaveCount(2);
  await expect.poll(async () => (await storeMediaKeys(shop.id)).length).toBe(2);

  // The order survives a reload.
  await page.reload();
  await expect(tiles).toHaveCount(2);
  await expect(tiles.first().locator('img')).toHaveAttribute(
    'alt',
    'Blue kurta, front',
  );

  // Publish it: the storefront shows the cover with its description.
  await page.getByLabel('Status', { exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Save' }).last().click();
  await expect(page.getByText('Product saved')).toBeVisible();
  const storefront = await page.context().newPage();
  await storefront.goto(storeUrl(shop.slug, '/p/product-01'));
  await expect(
    storefront.getByRole('img', { name: 'Blue kurta, front' }).first(),
  ).toBeVisible();
  await storefront.close();

  // Deleting the product removes its files too.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Product 01?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page).toHaveURL(app('/dashboard/products'));
  await expect.poll(async () => (await storeMediaKeys(shop.id)).length).toBe(0);
});
