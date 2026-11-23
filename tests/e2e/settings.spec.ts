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
  await page.goto(app('/dashboard/settings'));
  await page.locator('form[data-hydrated]').waitFor();
});

test.afterEach(async () => {
  await deleteStore(shop);
});

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(
    page.getByText('Saved. Your store shows the new details.'),
  ).toBeVisible();
}

test('store details show on the contact page and in the footer', async ({
  page,
}) => {
  // One save bar for the whole form, enabled once something changes.
  const bar = page.getByTestId('settings-save-bar');
  await expect(bar).toContainText('Store details saved and live');
  await expect(
    bar.getByRole('button', { name: 'Save details' }),
  ).toBeDisabled();

  // Edits not wanted are undone in one go.
  const city = page.getByLabel('City');
  const cityBefore = await city.inputValue();
  await city.fill('Nowhere');
  await bar.getByRole('button', { name: 'Undo edits' }).click();
  await expect(city).toHaveValue(cityBefore);
  await expect(bar).toContainText('Store details saved and live');
  await expect(bar.getByRole('button', { name: 'Undo edits' })).toHaveCount(0);

  // Mistakes are caught before saving.
  await page.getByLabel('WhatsApp number for orders').fill('12345');
  await page.getByLabel('City').fill('Kanchipuram');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(
    page.getByText('Enter a 10-digit Indian mobile number'),
  ).toBeVisible();
  await expect(page.getByText('Enter the street address')).toBeVisible();
  await expect(page.getByText('Choose the state')).toBeVisible();

  await page.getByLabel('Store name').fill('Kanchi Looms');
  await page.getByLabel('WhatsApp number for orders').fill('98765 43210');
  await page.getByLabel('Email').fill('hello@kanchilooms.example');
  await page.getByLabel('Phone').fill('044 2345 6789');
  await page.getByLabel('Shop address').fill('14 Sannathi Street');
  await page.getByLabel('State').selectOption('Tamil Nadu');
  await page.getByLabel('PIN code').fill('631502');
  await page.getByLabel('Opening hours').fill('Mon–Sat, 10 am – 8 pm');
  await expect(bar).toContainText('Unsaved changes to your store details');
  await save(page);

  // The number is stored in full and shown tidied.
  await page.reload();
  await page.locator('form[data-hydrated]').waitFor();
  await expect(page.getByLabel('WhatsApp number for orders')).toHaveValue(
    '+91 98765 43210',
  );

  const store = await page.context().newPage();
  await store.goto(storeUrl(shop.slug, '/contact'));
  await expect(
    store.getByRole('heading', { level: 1, name: 'Contact us' }),
  ).toBeVisible();
  const main = store.getByRole('main');
  await expect(main).toContainText('Kanchipuram, Tamil Nadu 631502');
  await expect(main).toContainText('Mon–Sat, 10 am – 8 pm');
  await expect(
    main.getByRole('link', { name: 'Chat on WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/919876543210\?/);
  await expect(
    main.getByRole('link', { name: '044 2345 6789' }),
  ).toHaveAttribute('href', 'tel:04423456789');
  await expect(
    main.getByRole('link', { name: 'Get directions' }),
  ).toHaveAttribute('href', /google\.com\/maps\/search/);
  // The new name and the details reach every page.
  await expect(
    store.getByRole('link', { name: 'Kanchi Looms home' }),
  ).toBeVisible();
  await expect(store.getByRole('contentinfo')).toContainText(
    '14 Sannathi Street',
  );

  // Online only: without an address, the store stops showing one.
  for (const label of ['Shop address', 'City', 'PIN code']) {
    await page.getByLabel(label).fill('');
  }
  await page.getByLabel('State').selectOption('');
  await save(page);
  await store.reload();
  await expect(store.getByRole('main')).not.toContainText('Sannathi Street');
  await expect(store.getByRole('contentinfo')).toContainText('Get in touch');
  await store.close();
});

test('a policy page is written, shown in the store and hidden again', async ({
  page,
}) => {
  const shipping = page.getByRole('link', { name: /^Shipping/ });
  await expect(shipping).toContainText('Not written');
  await shipping.click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Shipping' }),
  ).toBeVisible();
  await page
    .locator('form[data-hydrated]', { has: page.locator('#page-body') })
    .waitFor();

  // An empty page cannot go in the store.
  await page.getByRole('switch', { name: 'Show in store' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Write the page before showing it in your store'),
  ).toBeVisible();

  // The sample flags the parts still to fill in.
  await page.getByRole('button', { name: 'Start from a sample' }).click();
  await expect(page.getByTestId('placeholders')).toContainText('[2–3]');

  // The merchant writes their own text instead.
  await page
    .getByLabel('Text')
    .fill(
      'We ship across India within 3 days.\n\n- Free above ₹5,000\n- Tracking on WhatsApp',
    );
  await expect(page.getByTestId('placeholders')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Saved. The page is in your store.'),
  ).toBeVisible();

  // It is linked from the footer and shown as paragraphs and a list.
  const store = await page.context().newPage();
  await store.goto(storeUrl(shop.slug));
  await store
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Shipping' })
    .click();
  await expect(
    store.getByRole('heading', { level: 1, name: 'Shipping' }),
  ).toBeVisible();
  await expect(store.getByRole('main').getByRole('listitem')).toHaveText([
    'Free above ₹5,000',
    'Tracking on WhatsApp',
  ]);

  // Hidden again: the link and the page are gone.
  await page.getByRole('switch', { name: 'Show in store' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Saved. The page is hidden from your store.'),
  ).toBeVisible();
  // A render already under way when the cache was expired can still finish
  // with the old page; reload until the change shows.
  await expect(async () => {
    await store.reload();
    await expect(
      store.getByRole('heading', { name: "We couldn't find that page" }),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(
    store.getByRole('contentinfo').getByRole('link', { name: 'Shipping' }),
  ).toHaveCount(0);
  await store.close();

  await page.getByRole('link', { name: 'Back to settings' }).click();
  await expect(page.getByRole('link', { name: /^Shipping/ })).toContainText(
    'Hidden',
  );
});
