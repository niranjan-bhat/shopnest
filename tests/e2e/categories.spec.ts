import { expect, test, type Page } from '@playwright/test';
import {
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  signIn,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/categories'));
});

test.afterEach(async () => {
  await deleteStore(shop);
});

async function addCategory(page: Page, name: string, slug = '') {
  await page.getByRole('button', { name: 'Add category' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add category' });
  await dialog.getByLabel('Name').fill(name);
  if (slug) await dialog.getByLabel('URL').fill(slug);
  await dialog.getByRole('button', { name: 'Add category' }).click();
  return dialog;
}

const rows = (page: Page) => page.getByTestId('category-row');

test('a merchant builds, reorders, hides and deletes categories', async ({
  page,
}) => {
  await expect(page.getByTestId('no-categories')).toBeVisible();

  for (const name of ['Silk Sarees', 'Cotton', 'Linen']) {
    const dialog = await addCategory(page, name);
    await expect(dialog).toBeHidden();
  }
  await expect(rows(page)).toHaveText([/^Silk Sarees/, /^Cotton/, /^Linen/]);
  await expect(rows(page).first()).toContainText('/c/silk-sarees');

  // The URL must be unique within the store.
  const duplicate = await addCategory(page, 'Cotton');
  await expect(duplicate.getByRole('alert')).toHaveText(
    'Another category already uses this URL.',
  );
  // A name with no English letters needs a URL typed in.
  await duplicate.getByLabel('Name').fill('साड़ी');
  await duplicate.getByRole('button', { name: 'Add category' }).click();
  await expect(duplicate.getByRole('alert')).toContainText(
    'Add a URL using English letters',
  );
  await duplicate.getByRole('button', { name: 'Cancel' }).click();

  // Reorder with the keyboard: Linen moves to the top. Each step waits for
  // the screen-reader announcement, which also checks its wording.
  const announcer = page.locator('[id^="DndLiveRegion"]');
  await page.getByRole('button', { name: 'Move Linen' }).focus();
  await page.keyboard.press('Space');
  // "Picked up Linen…" is replaced at once by its starting position.
  await expect(announcer).toContainText('Linen is at position 3 of 3.');
  await page.keyboard.press('ArrowUp');
  await expect(announcer).toContainText('Linen is at position 2 of 3.');
  await page.keyboard.press('ArrowUp');
  await expect(announcer).toContainText('Linen is at position 1 of 3.');
  await page.keyboard.press('Space');
  await expect(announcer).toContainText('Linen dropped at position 1 of 3.');
  await expect(rows(page)).toHaveText([/^Linen/, /^Silk Sarees/, /^Cotton/]);

  // Hide Cotton.
  await page.getByRole('switch', { name: 'Show Cotton in store' }).click();
  await expect(rows(page).nth(2)).toContainText('Hidden');

  // Rename Silk Sarees and give it a shorter URL.
  await page.getByRole('button', { name: 'Edit Silk Sarees' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit category' });
  await edit.getByLabel('Name').fill('Silk');
  await edit.getByLabel('URL').fill('silk');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();

  // Everything survives a reload.
  await page.reload();
  await expect(rows(page)).toHaveText([/^Linen/, /^Silk/, /^Cotton.*Hidden/]);
  await expect(rows(page).nth(1)).toContainText('/c/silk');

  // The storefront follows: Silk is live, hidden Cotton is not.
  const storefront = await page.context().newPage();
  await storefront.goto(storeUrl(shop.slug, '/c/silk'));
  await expect(
    storefront.getByRole('heading', { level: 1, name: 'Silk' }),
  ).toBeVisible();
  // Streamed pages cannot change their status code, so check the page text
  // (as storefront.spec.ts does).
  await storefront.goto(storeUrl(shop.slug, '/c/cotton'));
  await expect(
    storefront.getByRole('heading', { name: "We couldn't find that page" }),
  ).toBeVisible();
  await storefront.close();

  // Delete Linen.
  await page.getByRole('button', { name: 'Delete Linen' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete Linen?' });
  await expect(confirm).toContainText('No products are in this category.');
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(rows(page)).toHaveText([/^Silk/, /^Cotton/]);
});
