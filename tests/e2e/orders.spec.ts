import { expect, test, type Page } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  listOrders,
  placeOrder,
  randomMobile,
  signIn,
  stockOf,
  updateProduct,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  shop = await createStore(testInfo);
  // "Product 01" and "Product 02": ₹1,000 each, one in stock.
  await createProducts(shop, 2, 'active');
});

test.afterEach(async () => {
  await deleteStore(shop);
});

/** Stops WhatsApp navigation and returns the pre-filled message text. */
async function captureWhatsApp(page: Page): Promise<() => Promise<string>> {
  await page.route('https://wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'whatsapp' }),
  );
  return async () => {
    await page.waitForURL(/^https:\/\/wa\.me\//);
    return new URL(page.url()).searchParams.get('text') ?? '';
  };
}

async function open(page: Page, path: string) {
  await page.goto(storeUrl(shop.slug, path));
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function addToBag(page: Page, slug: string) {
  await open(page, `/p/${slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByTestId('cart-count')).toBeVisible();
}

async function fillCheckout(page: Page, phone = randomMobile()) {
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel('Address', { exact: true }).fill('12 MG Road');
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('PIN code').fill('560001');
  await page.getByLabel('State').selectOption('Karnataka');
}

test('changes since the bag was filled are confirmed before the order is placed', async ({
  page,
}) => {
  const whatsappText = await captureWhatsApp(page);
  await addToBag(page, 'product-01');
  await addToBag(page, 'product-02');

  // While the shopper fills in the form, the store changes things.
  await open(page, '/checkout');
  await updateProduct(shop, 'product-01', { price_paise: 120000 });
  await updateProduct(shop, 'product-02', { status: 'draft' });
  await fillCheckout(page);
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();

  // Nothing is ordered at a price the shopper has not seen.
  const changes = page.getByTestId('order-changes');
  await expect(changes).toContainText('Product 01: was ₹1,000, now ₹1,200.');
  await expect(changes).toContainText(
    'Product 02 is no longer available and was removed from your bag.',
  );
  expect(await listOrders(shop)).toHaveLength(0);
  await expect(
    page.getByText('₹1,200').filter({ visible: true }).first(),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Confirm new prices and place order' })
    .click();

  // WhatsApp opens by itself, written from the server's prices.
  const text = await whatsappText();
  expect(text).toContain(
    `Hello ${shop.name}, I'd like to place an order (#1001):`,
  );
  expect(text).toContain('1. Product 01 × 1, ₹1,200 each');
  expect(text).not.toContain('Product 02');
  expect(text).toContain('Total: ₹1,200');
  expect(text).toContain('12 MG Road, Bengaluru, Karnataka 560001');

  // Back from WhatsApp: the confirmation page, which does not open it again.
  await page.goBack();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Order #1001' }),
  ).toBeVisible();
  await expect(page.getByTestId('order-line')).toHaveText([
    'Product 01 × 1₹1,200',
  ]);
  await expect(page.getByTestId('order-total')).toHaveText('₹1,200');
  await expect(page.getByTestId('order-status')).toHaveText(
    'Waiting for the store to confirm',
  );
  // The page leaves out the shopper's phone and address.
  await expect(page.getByText('12 MG Road')).toHaveCount(0);
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);

  // Saved once, at the confirmed price; the bag is empty.
  const orders = await listOrders(shop);
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    order_number: 1001,
    total_paise: 120000,
    order_items: [
      { name_snapshot: 'Product 01', unit_price_paise: 120000, qty: 1 },
    ],
  });
  await expect(page.getByTestId('cart-count')).toHaveCount(0);
});

test('another link to the order sends a short message, and unknown orders 404', async ({
  page,
  browser,
}) => {
  const whatsappText = await captureWhatsApp(page);
  await addToBag(page, 'product-01');
  await open(page, '/checkout');
  await fillCheckout(page);
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
  await whatsappText();
  await page.goBack();
  const orderUrl = page.url();

  // In another browser, the button sends only the order number.
  const other = await browser.newPage();
  await other.goto(orderUrl);
  await expect(
    other.getByRole('heading', { level: 1, name: 'Order #1001' }),
  ).toBeVisible();
  const href = await other.getByTestId('send-order').getAttribute('href');
  expect(new URL(href ?? '').searchParams.get('text')).toBe(
    `Hello ${shop.name}, I placed order #1001 on your website.`,
  );
  await other.goto(
    storeUrl(shop.slug, '/orders/00000000-0000-4000-8000-000000000000'),
  );
  await expect(
    other.getByRole('heading', { name: "We couldn't find that page" }),
  ).toBeVisible();
  await other.close();
});

test('exit: an order matches on WhatsApp and in the dashboard, and stock follows it', async ({
  page,
}, testInfo) => {
  // The shopper orders both products.
  const whatsappText = await captureWhatsApp(page);
  await addToBag(page, 'product-01');
  await addToBag(page, 'product-02');
  await open(page, '/checkout');
  await fillCheckout(page);
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
  const text = await whatsappText();
  expect(text).toContain('(#1001)');
  expect(text).toContain('Total: ₹2,000');
  await page.goBack();
  const orderUrl = page.url();

  // The merchant finds the same order, with the same total.
  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/orders'));
  await page.getByTestId('order-row').filter({ hasText: '#1001' }).click();
  await page.locator('[data-testid="order-actions"][data-hydrated]').waitFor();
  await expect(page.getByTestId('order-total')).toHaveText('₹2,000');

  // Confirming takes the stock, and the shopper's page says so.
  await page.getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByText('Order marked as confirmed')).toBeVisible();
  expect(await stockOf(shop, 'product-01')).toBe(0);
  expect(await stockOf(shop, 'product-02')).toBe(0);
  const shopper = await page.context().newPage();
  await shopper.goto(orderUrl);
  await expect(shopper.getByTestId('order-status')).toHaveText(
    'Confirmed by the store',
  );
  await shopper.close();

  // Cancelling puts it back.
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page
    .getByRole('alertdialog', { name: 'Cancel this order?' })
    .getByRole('button', { name: 'Cancel order' })
    .click();
  await expect(page.getByText('Order cancelled')).toBeVisible();
  expect(await stockOf(shop, 'product-01')).toBe(1);
  expect(await stockOf(shop, 'product-02')).toBe(1);
});

test('a fourth order within the hour from one phone is turned away kindly', async ({
  page,
}) => {
  // Three orders from this number already (the helpers' customer phone).
  for (let i = 0; i < 3; i++) {
    await placeOrder(shop, [{ productSlug: 'product-01', qty: 1 }]);
  }
  await addToBag(page, 'product-01');
  await open(page, '/checkout');
  await fillCheckout(page, '98765 43210');
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();

  const error = page.getByTestId('checkout-error');
  await expect(error).toContainText(
    `You've placed several orders in the last hour. Please message ${shop.name} on WhatsApp`,
  );
  await expect(
    error.getByRole('link', { name: 'Message the store on WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/919800000000\?text=/);
  expect(await listOrders(shop)).toHaveLength(3);

  // Another number is fine.
  const whatsappText = await captureWhatsApp(page);
  await page.getByLabel('Mobile number').fill(randomMobile());
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
  expect(await whatsappText()).toContain('(#1004)');
});

test('a bot that fills the hidden field places nothing', async ({ page }) => {
  await addToBag(page, 'product-01');
  await open(page, '/checkout');
  await fillCheckout(page);
  // Shoppers never see this field; a form-filling bot does.
  await page.locator('#website').fill('https://spam.example');
  await page.getByRole('button', { name: 'Place order on WhatsApp' }).click();
  await expect(page.getByTestId('checkout-error')).toContainText(
    'Something went wrong placing your order.',
  );
  expect(await listOrders(shop)).toHaveLength(0);
  await expect(page.getByTestId('cart-count')).toBeVisible();
});
