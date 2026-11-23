import { expect, test, type Page } from '@playwright/test';
import {
  createBanners,
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  setHomeSections,
  signIn,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  await setHomeSections(shop, [
    { type: 'hero', props: { ctaLabel: 'Shop now', ctaHref: '/' } },
  ]);
  await createBanners(shop, ['Festive edit', 'Old sale']);
  await createProducts(shop, 2, 'active');
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/storefront'));
  await page.locator('form[data-hydrated]').first().waitFor();
});

test.afterEach(async () => {
  await deleteStore(shop);
});

const rows = (page: Page) => page.getByTestId('section-row');
const bar = (page: Page) => page.getByTestId('publish-bar');
const status = (page: Page) => page.getByTestId('publish-status');

async function addSection(page: Page, type: RegExp, dialogName: string) {
  await page.getByRole('button', { name: 'Add section' }).click();
  await page.getByRole('menuitem', { name: type }).click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await dialog.locator('form[data-hydrated]').waitFor();
  return dialog;
}

/** Waits for the screen-reader announcement, re-pressing a lost key. */
async function moveUpTo(page: Page, position: string) {
  const announcer = page.locator('[id^="DndLiveRegion"]').filter({
    hasText: /./,
  });
  await expect(async () => {
    const text = (await announcer.last().textContent()) ?? '';
    if (!text.includes(position)) await page.keyboard.press('ArrowUp');
    await expect(announcer.last()).toContainText(position, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test('a merchant builds the home page in the draft, then publishes it', async ({
  page,
}) => {
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('All live banners');
  await expect(status(page)).toContainText('Live');

  // A brand story needs its text.
  const story = await addSection(page, /^Brand story/, 'Add brand story');
  await story.getByLabel('Heading', { exact: true }).fill('Woven by hand');
  await story.getByRole('button', { name: 'Add section' }).click();
  await expect(
    story.getByText('Write a few lines about your brand'),
  ).toBeVisible();
  await story.getByLabel('Text').fill('Forty weaving families.');
  await story.getByRole('button', { name: 'Add section' }).click();
  await expect(story).toBeHidden();
  await expect(rows(page)).toHaveCount(2);
  await expect(status(page)).toContainText('Unpublished changes');

  // A grid of the newest products.
  const grid = await addSection(page, /^Product grid/, 'Add product grid');
  await grid.getByLabel('Title', { exact: true }).fill('Just in');
  await grid.getByLabel('Show').selectOption('newest');
  await grid.getByLabel('How many').selectOption('4');
  await grid.getByRole('button', { name: 'Add section' }).click();
  await expect(grid).toBeHidden();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(2)).toContainText('Up to 4 newest products');

  // Move the grid above the brand story.
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.request().headers()['next-action'] !== undefined,
  );
  await page
    .getByRole('button', { name: 'Move Product grid: Just in', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await moveUpTo(page, 'position 2 of 3');
  await page.keyboard.press('Space');
  await expect(rows(page).nth(1)).toContainText('Just in');
  await saved;

  // The hero shows only the chosen banner.
  await page.getByRole('button', { name: 'Edit Hero', exact: true }).click();
  const hero = page.getByRole('dialog', { name: 'Edit hero' });
  await hero.locator('form[data-hydrated]').waitFor();
  await hero.getByLabel('Only the ones I choose').check();
  await hero.getByRole('button', { name: 'Save' }).click();
  await expect(hero.getByText('Choose at least one banner')).toBeVisible();
  await hero.getByRole('checkbox', { name: 'Festive edit' }).check();
  await hero.getByRole('button', { name: 'Save' }).click();
  await expect(hero).toBeHidden();
  await expect(rows(page).first()).toContainText('1 chosen banner');

  // Remove the brand story again.
  await page
    .getByRole('button', { name: 'Remove Brand story: Woven by hand' })
    .click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText('Section removed from the draft')).toBeVisible();

  // The order and choices survive a reload.
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('1 chosen banner');
  await expect(rows(page).nth(1)).toContainText('Just in');

  // Shoppers still see the old home page; the preview shows the draft.
  const live = await page.context().newPage();
  await live.goto(storeUrl(shop.slug));
  await expect(
    live.getByRole('heading', { name: 'Festive edit' }),
  ).toBeVisible();
  await expect(live.getByRole('heading', { name: 'Just in' })).toHaveCount(0);

  const preview = await page.context().newPage();
  await preview.goto(app('/preview'));
  await expect(preview.getByRole('heading', { name: 'Just in' })).toBeVisible();
  await expect(preview.getByText('Old sale')).toHaveCount(0);
  await preview.close();

  // Publish: the live home page changes.
  await bar(page).getByRole('button', { name: 'Publish' }).click();
  await expect(
    page.getByText('Published. Your store is updated.'),
  ).toBeVisible();
  await live.reload();
  await expect(live.getByRole('heading', { name: 'Just in' })).toBeVisible();
  await expect(live.getByText('Old sale')).toHaveCount(0);
  await expect(live.getByText('Woven by hand')).toHaveCount(0);
  await live.close();
});
