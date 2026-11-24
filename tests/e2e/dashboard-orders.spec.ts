import { expect, test, type Page } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  listOrders,
  placeOrder,
  signIn,
  stockOf,
  updateProduct,
  type TestStore,
} from './helpers';
import { app } from './urls';

let shop: TestStore;

test.beforeEach(async ({ page }, testInfo) => {
  shop = await createStore(testInfo);
  // "Product 01": ₹1,000, one in stock. "Product 02": price on request.
  await createProducts(shop, 2, 'active');
  await updateProduct(shop, 'product-02', {
    price_mode: 'on_request',
    price_paise: null,
  });
  // #1001 wants the saree and the necklace; #1002 wants the same saree.
  await placeOrder(shop, [
    { productSlug: 'product-01', qty: 1 },
    { productSlug: 'product-02', qty: 1 },
  ]);
  await placeOrder(shop, [{ productSlug: 'product-01', qty: 1 }], 'Ravi Kumar');

  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard/orders'));
});

test.afterEach(async () => {
  await deleteStore(shop);
});

test('the order list fits the screen', async ({ page }) => {
  await expect(rows(page)).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - screen.width,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

const rows = (page: Page) => page.getByTestId('order-row');
const badge = (page: Page) => page.getByTestId('order-status-badge');

async function openOrder(page: Page, number: number) {
  await page.goto(app('/dashboard/orders'));
  await rows(page)
    .filter({ hasText: `#${number}` })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Order #${number}` }),
  ).toBeVisible();
  await page.locator('[data-testid="order-actions"][data-hydrated]').waitFor();
}

async function move(page: Page, button: string, toast: string) {
  await page.getByRole('button', { name: button }).click();
  await expect(page.getByText(toast)).toBeVisible();
}

test('orders are listed, filtered and searched', async ({ page }) => {
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('#1002');
  await expect(rows(page).first()).toContainText('Ravi Kumar');
  await expect(rows(page).first()).toContainText('New');
  await expect(rows(page).nth(1)).toContainText('+ prices to agree');
  await expect(
    page.getByRole('navigation', { name: 'Order status' }),
  ).toContainText('New 2');

  const search = page.getByRole('searchbox', { name: 'Search orders' });
  await search.fill('1001');
  await search.press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Asha Rao');

  await search.fill('ravi');
  await search.press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('#1002');

  await page.goto(app('/dashboard/orders?status=delivered'));
  await expect(page.getByText('No orders match.')).toBeVisible();
});

test('a merchant prices, confirms and delivers an order; stock follows', async ({
  page,
}) => {
  // A New order shows each item's stock before the merchant agrees it.
  const stock = page.getByTestId('line-stock');
  await openOrder(page, 1002);
  await expect(stock).toHaveText(['1 in stock']);

  // #1002 takes the last saree; its stock is no longer shown.
  await move(page, 'Confirm order', 'Order marked as confirmed');
  await expect(badge(page)).toHaveText('Confirmed');
  await expect(stock).toHaveCount(0);
  expect(await stockOf(shop, 'product-01')).toBe(0);

  // #1001: the necklace needs its agreed price before it can be confirmed.
  await openOrder(page, 1001);
  const customer = page.getByTestId('order-customer');
  await expect(customer).toContainText('+91 98765 43210');
  await expect(customer).toContainText('Please call before delivery');
  await expect(
    customer.getByRole('link', { name: 'Chat on WhatsApp' }),
  ).toHaveAttribute('href', /^https:\/\/wa\.me\/919876543210\?text=/);
  const confirm = page.getByRole('button', { name: 'Confirm order' });
  await expect(confirm).toBeDisabled();
  // The saree is gone before #1001 is agreed: the merchant can see it.
  await expect(stock).toHaveText(['Out of stock', '1 in stock']);

  await page.getByLabel('Agreed price for Product 02, each').fill('2500');
  await expect(page.getByTestId('order-total')).toHaveText('₹3,500');
  await move(page, 'Save prices', 'Prices saved');
  await expect(confirm).toBeEnabled();

  // The saree went to #1002: nothing moves.
  await confirm.click();
  await expect(page.getByTestId('short-stock')).toContainText(
    'Product 01: ordered 1, 0 in stock',
  );
  await expect(badge(page)).toHaveText('New');

  // Cancelling #1002 puts its saree back.
  await openOrder(page, 1002);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page
    .getByRole('alertdialog', { name: 'Cancel this order?' })
    .getByRole('button', { name: 'Cancel order' })
    .click();
  await expect(page.getByText('Order cancelled')).toBeVisible();
  await expect(badge(page)).toHaveText('Cancelled');
  expect(await stockOf(shop, 'product-01')).toBe(1);

  // Now #1001 goes all the way.
  await openOrder(page, 1001);
  await expect(stock).toHaveText(['1 in stock', '1 in stock']);
  await move(page, 'Confirm order', 'Order marked as confirmed');
  expect(await stockOf(shop, 'product-01')).toBe(0);
  await expect(
    page.getByLabel('Agreed price for Product 02, each'),
  ).toHaveCount(0);
  await move(page, 'Mark as packed', 'Order marked as packed');
  await move(page, 'Mark as shipped', 'Order marked as shipped');
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(
    0,
  );
  await move(page, 'Mark as delivered', 'Order marked as delivered');
  await expect(badge(page)).toHaveText('Delivered');
  await expect(
    page.getByTestId('order-actions').getByRole('button'),
  ).toHaveCount(0);

  // The store's own notes.
  await page.getByLabel('Your notes').fill('Sent by DTDC, AWB 123');
  await move(page, 'Save notes', 'Notes saved');
  await page.reload();
  await expect(page.getByLabel('Your notes')).toHaveValue(
    'Sent by DTDC, AWB 123',
  );

  const [order] = (await listOrders(shop)).filter(
    (o) => o.order_number === 1001,
  );
  expect(order?.total_paise).toBe(350000);
});
