import { expect, test } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  signIn,
  type TestStore,
} from './helpers';
import { app } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  await createProducts(shop, 30);
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
});

test.afterEach(async () => {
  await deleteStore(shop);
});

test('the product list shows 25 at a time', async ({ page }) => {
  // Next.js keeps visited pages mounted but hidden: count visible ones.
  const rows = page.getByTestId('product-row').filter({ visible: true });
  const summary = page.getByTestId('page-summary').filter({ visible: true });
  const pages = page.getByRole('navigation', { name: 'Pages' });

  await page.goto(app('/dashboard/products'));
  await expect(rows).toHaveCount(25);
  await expect(rows.first()).toContainText('Product 01');
  await expect(summary).toHaveText('Showing 1–25 of 30');
  await expect(pages.getByRole('link', { name: 'Previous' })).toHaveCount(0);

  await pages.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(app('/dashboard/products?page=2'));
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText('Product 26');
  await expect(summary).toHaveText('Showing 26–30 of 30');

  // The tab counts cover every product, not just this page.
  await expect(
    page.getByRole('navigation', { name: 'Product status' }),
  ).toContainText('All 30');

  // A search starts again at page 1.
  const search = page.getByRole('searchbox', { name: 'Search products' });
  await search.fill('Product 0');
  await search.press('Enter');
  await expect(page).toHaveURL(app('/dashboard/products?q=Product+0'));
  await expect(rows).toHaveCount(9);
  await expect(pages).toHaveCount(0);

  // A page past the end offers the last page.
  await page.goto(app('/dashboard/products?page=9'));
  await page.getByRole('link', { name: 'Go to the last page' }).click();
  await expect(page).toHaveURL(app('/dashboard/products?page=2'));
  await expect(rows).toHaveCount(5);
});
