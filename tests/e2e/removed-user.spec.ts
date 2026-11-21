import { expect, test } from '@playwright/test';
import {
  createStore,
  deleteStore,
  deleteUser,
  freshEmail,
  grantAccess,
  revokeStore,
  signIn,
  type TestStore,
} from './helpers';
import { app } from './urls';

// A person taken out of a store, or whose account is deleted, must lose
// access on their very next request, even though they are still "signed
// in" in their browser.

let shop: TestStore;
test.beforeEach(async ({}, testInfo) => {
  shop = await createStore(testInfo);
});
test.afterEach(async () => {
  await deleteStore(shop);
});

test('a member removed from the store loses it at once', async ({
  page,
}, testInfo) => {
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/categories'));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Categories' }),
  ).toBeVisible();

  await revokeStore(email, shop.slug);
  await page.goto(app('/dashboard/categories'));
  await expect(page).toHaveURL(app('/dashboard'));
  await expect(page.getByTestId('no-stores')).toBeVisible();
});

test('a deleted account is signed out at once', async ({ page }, testInfo) => {
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/categories'));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Categories' }),
  ).toBeVisible();

  await deleteUser(email);
  await page.goto(app('/dashboard/categories'));
  await expect(page).toHaveURL(app('/login?next=%2Fdashboard%2Fcategories'));
});
