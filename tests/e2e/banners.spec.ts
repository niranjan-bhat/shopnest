import { expect, test, type Page } from '@playwright/test';
import {
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  setHomeSections,
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
  // A hero that lists no banners shows every live one.
  await setHomeSections(shop, [
    { type: 'hero', props: { ctaLabel: 'Shop now', ctaHref: '/' } },
  ]);
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/storefront'));
  await page.locator('form[data-hydrated]').waitFor();
});

test.afterEach(async () => {
  await deleteStoreMedia(shop.id);
  await deleteStore(shop);
});

const rows = (page: Page) => page.getByTestId('banner-row');

/** Tomorrow at 10:00, as a datetime-local value. */
function tomorrow(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${date.toISOString().slice(0, 10)}T10:00`;
}

async function addBanner(
  page: Page,
  heading: string,
  fields: { link?: string; startsAt?: string } = {},
) {
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Add banner' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add banner' });
  await dialog.locator('form[data-hydrated]').waitFor();
  await dialog
    .getByLabel('Upload banner photo')
    .setInputFiles(pngFile('banner.png', [150, 40, 60], 400, 200));
  await expect(
    dialog.getByRole('button', { name: 'Remove banner photo' }),
  ).toBeVisible();
  await dialog.getByLabel('Heading').fill(heading);
  if (fields.link) await dialog.getByLabel('Link').fill(fields.link);
  if (fields.startsAt) {
    await dialog.getByLabel('Show from').fill(fields.startsAt);
  }
  await dialog.getByRole('button', { name: 'Add banner' }).click();
  await expect(dialog).toBeHidden();
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

test('a merchant adds, schedules, orders, edits and deletes banners', async ({
  page,
}) => {
  await expect(page.getByText('No banners yet.')).toBeVisible();

  // A bad link is caught before anything is saved.
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Add banner' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add banner' });
  await dialog.locator('form[data-hydrated]').waitFor();
  await dialog.getByLabel('Link').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Add banner' }).click();
  await expect(
    dialog.getByText('Upload a photo for the banner.'),
  ).toBeVisible();
  await expect(dialog.getByText(/Use a store page such as/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  // A live banner shows on the store at once, without publishing.
  await addBanner(page, 'The Diwali edit', { link: '/c/sarees' });
  await expect(page.getByText('Banner added')).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Live');
  await expect(rows(page).first()).toContainText('/c/sarees');

  const home = await page.context().newPage();
  await home.goto(storeUrl(shop.slug));
  await expect(
    home.getByRole('heading', { name: 'The Diwali edit' }),
  ).toBeVisible();
  await expect(home.getByRole('link', { name: 'Shop now' })).toHaveAttribute(
    'href',
    '/c/sarees',
  );

  // A scheduled banner waits for its time.
  await addBanner(page, 'Wedding season', { startsAt: tomorrow() });
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toContainText('Scheduled');
  await home.reload();
  await expect(
    home.getByRole('heading', { name: 'The Diwali edit' }),
  ).toBeVisible();
  await expect(home.getByText('Wedding season')).toHaveCount(0);
  await home.close();
  expect(await storeMediaKeys(shop.id)).toHaveLength(2);

  // Move it first with the keyboard; the order survives a reload.
  await page.getByRole('button', { name: 'Move Wedding season' }).focus();
  await page.keyboard.press('Space');
  await moveUpTo(page, 'position 1 of 2');
  // The order saves in the background; wait for it before reloading.
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.request().headers()['next-action'] !== undefined,
  );
  await page.keyboard.press('Space');
  await expect(rows(page).first()).toContainText('Wedding season');
  await saved;
  await page.reload();
  await expect(rows(page).first()).toContainText('Wedding season');

  // Edit: the end must come after the start.
  await page.getByRole('button', { name: 'Edit Wedding season' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit banner' });
  await edit.locator('form[data-hydrated]').waitFor();
  await expect(edit.getByLabel('Show from')).toHaveValue(tomorrow());
  await edit.getByLabel('Show until').fill(tomorrow());
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit.getByText('End after the start')).toBeVisible();
  await edit.getByLabel('Show until').fill('');
  await edit.getByLabel('Heading').fill('Wedding season 2027');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await expect(rows(page).first()).toContainText('Wedding season 2027');

  // Delete: it leaves the store and the bucket.
  await page.getByRole('button', { name: 'Delete The Diwali edit' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete “The Diwali edit”?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(rows(page)).toHaveCount(1);
  await expect.poll(async () => (await storeMediaKeys(shop.id)).length).toBe(1);
});
