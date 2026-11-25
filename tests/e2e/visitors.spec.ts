import { expect, test, type Page } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  freshEmail,
  grantAccess,
  placeOrder,
  signIn,
  type TestStore,
} from './helpers';
import { app, store as storeUrl } from './urls';

let shop: TestStore;

test.beforeEach(async ({}, testInfo) => {
  shop = await createStore(testInfo);
  await createProducts(shop, 2, 'active');
});

test.afterEach(async () => {
  await deleteStore(shop);
});

/** Does something, and waits until the store has reported it. */
async function counted(
  page: Page,
  event: string,
  action: () => Promise<unknown>,
) {
  const sent = page.waitForResponse(
    (r) =>
      r.url().endsWith('/visit') &&
      (r.request().postData() ?? '').includes(`"${event}"`),
  );
  await action();
  expect((await sent).status()).toBe(204);
}

test('a merchant sees who came, what they viewed and how far they got', async ({
  browser,
  page,
}, testInfo) => {
  // A shopper comes twice, looks at a product, bags it and asks about it.
  const shopper = await (await browser.newContext()).newPage();
  await shopper
    .context()
    .route('https://wa.me/**', (route) => route.fulfill({ body: 'WhatsApp' }));
  const product = storeUrl(shop.slug, '/p/product-01');
  await counted(shopper, 'visit', () => shopper.goto(storeUrl(shop.slug)));
  await counted(shopper, 'product', () => shopper.goto(product));
  await shopper.locator('html[data-hydrated]').waitFor();
  await counted(shopper, 'bag', () =>
    shopper.getByRole('button', { name: 'Add to bag' }).click(),
  );
  await counted(shopper, 'product', () => shopper.goto(product));
  await counted(shopper, 'chat', () =>
    shopper.getByRole('link', { name: 'Ask about this on WhatsApp' }).click(),
  );
  await shopper.context().close();
  await placeOrder(shop, [{ productSlug: 'product-01', qty: 1 }]);

  const email = freshEmail(testInfo);
  await signIn(page, email);
  await grantAccess(email, { store: shop.slug });
  await page.goto(app('/dashboard'));
  const card = page.getByTestId('visitors').filter({ visible: true });
  await expect(card.locator('dd')).toHaveText(['1', '1', '1', '1']);
  await expect(card.getByRole('listitem')).toHaveText(['Product 011 person']);
  // Pointing at (or tapping) a day says how many came.
  await card.getByRole('img').locator('> div').last().hover();
  await expect(card.getByTestId('chart-day')).toContainText('1 visitor');
  await card.getByText('Show as a table').click();
  await expect(card.locator('tbody tr')).toHaveCount(7);
  await expect(card.locator('tbody tr').first()).toContainText('1');

  await card.getByRole('link', { name: '30 days' }).click();
  await expect(page).toHaveURL(/days=30/);
  await expect(card.locator('tbody tr')).toHaveCount(30);
  await card.getByRole('link', { name: 'Today' }).click();
  await expect(page).toHaveURL(/days=1$/);
  await expect(card.locator('table')).toHaveCount(0);
  await expect(card.locator('dd').first()).toHaveText('1');

  // Opening the store from the dashboard is not a visit, then or later.
  const opened = page.context().waitForEvent('page');
  await page.getByRole('link', { name: 'View store' }).first().click();
  const own = await opened;
  const visits: string[] = [];
  own.on('request', (r) => {
    if (r.url().endsWith('/visit')) visits.push(r.url());
  });
  await own.locator('html[data-hydrated]').waitFor();
  await expect
    .poll(() => own.evaluate(() => localStorage.getItem('zarify-team')))
    .toBe('1');
  await own.goto(product);
  await own.locator('html[data-hydrated]').waitFor();
  await own.waitForTimeout(1000);
  expect(visits).toEqual([]);
});

test('only the store itself can report visits', async ({ request }) => {
  const url = storeUrl(shop.slug, '/visit');
  const attempts: Record<string, string>[] = [
    {},
    { origin: 'https://elsewhere.example' },
  ];
  for (const headers of attempts) {
    const response = await request.post(url, {
      headers,
      data: '{"event":"visit"}',
    });
    expect(response.status()).toBe(204);
  }
});
