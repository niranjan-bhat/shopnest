import { expect, test, type Page } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  listOrders,
  placeOrder,
  setStock,
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

/** Opens a dashboard section from the sidebar, or the menu on phones. */
async function openSection(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  const nav = page.getByRole('navigation', { name: 'Dashboard' });
  // The menu may not be interactive yet, or still be closing: try again.
  await expect(async () => {
    if (!(await nav.isVisible()) && (await menu.isVisible())) {
      await menu.click({ timeout: 1000 });
    }
    await nav.getByRole('link', { name }).click({ timeout: 2000 });
  }).toPass();
}

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

test('the product form shows the stock an order left, keeping unsaved edits', async ({
  page,
}) => {
  const stock = page
    .getByRole('textbox', { name: 'Stock for Default' })
    .filter({ visible: true });
  const name = page.getByLabel('Name', { exact: true }).filter({
    visible: true,
  });
  // Moves through links only: a reload would hide a form left over from the
  // first visit.
  const openProduct = async () => {
    await openSection(page, 'Products');
    await page
      .getByRole('link', { name: 'Product 01' })
      .filter({ visible: true })
      .first()
      .click();
    await expect(name).toBeVisible();
  };

  test.slow(); // Many moves through the phone menu.
  await expect(rows(page)).toHaveCount(2);
  await openProduct();
  await expect(stock).toHaveValue('1');
  await name.fill('Product 01 renamed');

  await openSection(page, 'Orders');
  await rows(page)
    .filter({ hasText: '#1002' })
    .filter({ visible: true })
    .click();
  await page.locator('[data-testid="order-actions"][data-hydrated]').waitFor();
  await move(page, 'Confirm order', 'Order marked as confirmed');
  expect(await stockOf(shop, 'product-01')).toBe(0);

  await openProduct();
  await expect(stock).toHaveValue('0');
  await expect(name).toHaveValue('Product 01 renamed');

  // Restocking saves the new number.
  await stock.fill('5');
  await page
    .getByRole('button', { name: 'Save', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByText('Product saved')).toBeVisible();
  expect(await stockOf(shop, 'product-01')).toBe(5);

  // A change made elsewhere (another device) shows on the next visit.
  await openSection(page, 'Orders');
  await setStock(shop, 'product-01', 3);
  await openSection(page, 'Products');
  await page
    .getByRole('link', { name: 'Product 01 renamed' })
    .filter({ visible: true })
    .first()
    .click();
  await expect(stock).toHaveValue('3');
});

test('saving a product never overwrites what changed meanwhile', async ({
  page,
}) => {
  const productForm = async (tab: Page) => {
    await tab.goto(app('/dashboard/products'));
    await tab.getByRole('link', { name: 'Product 01' }).first().click();
    await expect(tab.getByLabel('Name', { exact: true })).toBeVisible();
  };
  const save = (tab: Page) =>
    tab.getByRole('button', { name: 'Save', exact: true }).click();
  const details = (tab: Page) => tab.locator('#product-description');
  const stock = page.getByRole('textbox', { name: 'Stock for Default' });

  // An order takes the last one while the form is open: editing the
  // description leaves the stock alone.
  await productForm(page);
  await expect(stock).toHaveValue('1');
  await setStock(shop, 'product-01', 0);
  await details(page).fill('Silk');
  await save(page);
  await expect(page.getByText('Product saved')).toBeVisible();
  expect(await stockOf(shop, 'product-01')).toBe(0);
  await expect(stock).toHaveValue('0');

  // Changing a number that moved is asked about first, then saved.
  await stock.fill('10');
  await setStock(shop, 'product-01', 3);
  await save(page);
  await expect(
    page.getByText('Stock changed to 3 while you were editing.'),
  ).toBeVisible();
  expect(await stockOf(shop, 'product-01')).toBe(3);
  await expect(stock).toHaveValue('10');
  await save(page);
  await expect.poll(() => stockOf(shop, 'product-01')).toBe(10);

  // Two windows: the second save is refused, not silently last.
  const other = await page.context().newPage();
  await productForm(other);
  await page.reload();
  await expect(stock).toHaveValue('10');
  await details(other).fill('Cotton');
  await save(other);
  await expect(other.getByText('Product saved')).toBeVisible();
  await details(page).fill('Linen');
  await save(page);
  await expect(
    page.getByText('This product was changed in another window.'),
  ).toBeVisible();
});
