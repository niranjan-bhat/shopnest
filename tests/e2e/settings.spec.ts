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
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Saved. Your store shows the new details.'),
  ).toBeVisible();
}

test('store details show on the contact page and in the footer', async ({
  page,
}) => {
  // Mistakes are caught before saving.
  await page.getByLabel('WhatsApp number for orders').fill('12345');
  await page.getByLabel('City').fill('Kanchipuram');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
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
