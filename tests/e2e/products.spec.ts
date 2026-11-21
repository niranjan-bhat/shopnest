import { expect, test, type Page } from '@playwright/test';
import {
  createCategory,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  signIn,
  variantIds,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  await createCategory(shop, 'Kurta sets', 'kurta-sets');
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
});

test.afterEach(async () => {
  await deleteStore(shop);
});

const sizeButton = (page: Page, size: string) =>
  page
    .getByRole('group', { name: 'Sizes' })
    .getByRole('button', { name: size, exact: true });

async function save(page: Page, toast: string) {
  await page
    .getByRole('button', { name: /^(Save|Add product)$/ })
    .last()
    .click();
  await expect(page.getByText(toast)).toBeVisible();
}

test('a merchant adds, edits and deletes a product', async ({ page }) => {
  await page.goto(app('/dashboard/products'));
  await expect(page.getByTestId('no-products')).toBeVisible();
  await page.getByRole('link', { name: 'Add product' }).click();
  await expect(page).toHaveURL(app('/dashboard/products/new'));

  // Problems are pointed out before anything is saved.
  await page.getByLabel('Compare-at price (₹)').fill('1999');
  await page.getByLabel('Price (₹)', { exact: true }).fill('2,499');
  await page.getByRole('button', { name: 'Add product' }).last().click();
  await expect(page.getByText('Enter a name')).toBeVisible();
  await expect(page.getByText('Must be more than the price')).toBeVisible();

  // Basics, price and details.
  await page.getByLabel('Name', { exact: true }).fill('Rust Kurta Set');
  await page.getByLabel('Compare-at price (₹)').fill('2999');
  await page.getByLabel('Fabric', { exact: true }).fill('Cotton');
  await page.getByRole('button', { name: 'Add a detail' }).click();
  await page.getByLabel('Detail 1 name').fill('Work');
  await page.getByLabel('Detail 1 value').fill('Gota patti');

  // Sizes S and M in one colour: two variants.
  await sizeButton(page, 'S').click();
  await sizeButton(page, 'M').click();
  await page.getByRole('textbox', { name: 'Add a colour' }).fill('Rust');
  await page.getByRole('textbox', { name: 'Add a colour' }).press('Enter');
  // Next.js keeps visited pages mounted but hidden, so count visible rows.
  const rows = page.getByTestId('variant-row').filter({ visible: true });
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Stock for Rust · S', { exact: true }).fill('3');
  await page.getByLabel('Stock for Rust · M', { exact: true }).fill('1');
  await page.getByLabel('Price for Rust · M', { exact: true }).fill('2599');
  await page.getByLabel('SKU for Rust · S', { exact: true }).fill('RKS-S');

  await page.getByLabel('Kurta sets').check();
  await page.getByLabel('Status', { exact: true }).selectOption('active');
  await save(page, 'Product added');
  await expect(page).toHaveURL(/\/dashboard\/products\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rust Kurta Set' }),
  ).toBeVisible();

  // It is live on the storefront, with its details and category.
  const storefront = await page.context().newPage();
  await storefront.goto(storeUrl(shop.slug, '/p/rust-kurta-set'));
  await expect(
    storefront.getByRole('heading', { level: 1, name: 'Rust Kurta Set' }),
  ).toBeVisible();
  await expect(storefront.getByText('₹2,499').first()).toBeVisible();
  await expect(storefront.getByText('Gota patti')).toBeVisible();
  await storefront.goto(storeUrl(shop.slug, '/c/kurta-sets'));
  await expect(storefront.getByText('Rust Kurta Set')).toBeVisible();

  // Edit: drop size M, restock S. S keeps its id (carts holding it work).
  const before = await variantIds(shop, 'rust-kurta-set');
  await sizeButton(page, 'M').click();
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Stock for Rust · S', { exact: true }).fill('5');
  await save(page, 'Product saved');
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(
    page.getByLabel('Stock for Rust · S', { exact: true }),
  ).toHaveValue('5');
  await expect(
    page.getByLabel('SKU for Rust · S', { exact: true }),
  ).toHaveValue('RKS-S');
  const after = await variantIds(shop, 'rust-kurta-set');
  expect(after).toEqual({ 'Rust · S': before['Rust · S'] });

  // The list shows it and finds it.
  await page.getByRole('link', { name: 'Back to products' }).click();
  const list = page.getByTestId('product-row').filter({ visible: true });
  await expect(list).toHaveCount(1);
  await expect(list).toContainText('5 in stock');
  await expect(list).toContainText('Kurta sets');
  await page.getByRole('searchbox', { name: 'Search products' }).fill('zzz');
  await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
  await expect(page.getByText('No products match.')).toBeVisible();
  await page.getByRole('link', { name: 'Show all products' }).click();

  // Adding another product starts from a blank form.
  await page.getByRole('link', { name: 'Add product' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('');
  await expect(rows).toHaveCount(1);
  await page.getByRole('link', { name: 'Back to products' }).click();

  // Delete.
  await list.getByRole('link').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Rust Kurta Set?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page).toHaveURL(app('/dashboard/products'));
  await expect(page.getByTestId('no-products')).toBeVisible();
});

test('a price-on-request product hides prices', async ({ page }) => {
  await page.goto(app('/dashboard/products/new'));
  await page.getByLabel('Name', { exact: true }).fill('Bridal Lehenga');
  await page.getByText('Price on request').click();
  await expect(page.getByLabel('Price (₹)', { exact: true })).toHaveCount(0);
  await page.getByLabel('Stock for Default', { exact: true }).fill('1');
  await page.getByLabel('Status', { exact: true }).selectOption('active');
  await save(page, 'Product added');

  const storefront = await page.context().newPage();
  await storefront.goto(storeUrl(shop.slug, '/p/bridal-lehenga'));
  await expect(storefront.getByText('Price on request').first()).toBeVisible();
});
