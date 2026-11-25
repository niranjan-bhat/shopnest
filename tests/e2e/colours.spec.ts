import { expect, test } from '@playwright/test';
import {
  addColours,
  createCategory,
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  linkCategory,
  signIn,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({}, testInfo) => {
  shop = await createStore(testInfo);
  await createCategory(shop, 'Sarees', 'sarees');
  await createProducts(shop, 1, 'active');
  await linkCategory(shop, 'product-01', 'sarees');
  // Photos 1 (green), 2 (for every colour) and 3 (not tagged yet).
  await addColours(shop, 'product-01', ['Green', 'Red'], ['Green', null, null]);
});

test.afterEach(async () => {
  await deleteStore(shop);
});

test('a merchant tags photos; shoppers see the colour they choose', async ({
  page,
}, testInfo) => {
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });

  await page.goto(app('/dashboard/products'));
  await page.getByRole('link', { name: /Product 01/ }).click();
  await expect(page.getByLabel('Colour of photo 1')).toHaveValue('Green');
  await expect(page.getByLabel('Colour of photo 3')).toHaveValue('');
  // Colour is an option, not a detail.
  await expect(page.locator('#attr-colour')).toHaveCount(0);
  await page.getByLabel('Colour of photo 3').selectOption('Red');
  await expect(page.getByText('Photo colour saved')).toBeVisible();

  // Filtering by red: its photo on the card, and the product opens on red.
  await page.goto(storeUrl(shop.slug, '/c/sarees?colour=red'));
  const card = page.locator('main article');
  await expect(card).toHaveCount(1);
  await expect(card.locator('img').first()).toHaveAttribute('src', /photo-3/);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(/colour=Red/);
  const red = page.getByRole('button', { name: 'Red', exact: true });
  const photos = page.getByRole('button', { name: /^Zoom image/ });
  await expect(red).toHaveAttribute('aria-pressed', 'true');
  await expect(photos).toHaveCount(2);
  await expect(photos.first().locator('img')).toHaveAttribute('src', /photo-3/);

  // In the order the merchant entered them.
  await expect(
    page.getByRole('group', { name: /^Colour/ }).getByRole('button'),
  ).toHaveText(['Green', 'Red']);

  // Green: its own photo, and the one for every colour.
  await page.getByRole('button', { name: 'Green', exact: true }).click();
  await expect(photos).toHaveCount(2);
  await expect(photos.first().locator('img')).toHaveAttribute('src', /photo-1/);
  await expect(photos.nth(1).locator('img')).toHaveAttribute('src', /photo-2/);

  // The bag shows the colour chosen.
  await page.getByRole('button', { name: 'Add to bag' }).click();
  const line = page.getByTestId('cart-line').first();
  await expect(line).toContainText('Green');
  await expect(line.locator('img')).toHaveAttribute('src', /photo-1/);

  // Both colours are in the filter.
  await page.goto(storeUrl(shop.slug, '/c/sarees?colour=Green'));
  await expect(card).toHaveCount(1);
  await page.goto(storeUrl(shop.slug, '/c/sarees?colour=Blue'));
  await expect(card).toHaveCount(0);
});

test('a product with one colour names it', async ({ page }) => {
  await page.goto(storeUrl('saree-demo', '/p/ruby-temple-border-kanjivaram'));
  await expect(page.locator('legend')).toHaveText('Colour: Red');
  await expect(
    page.getByRole('button', { name: 'Red', exact: true }),
  ).toHaveCount(0);
});
