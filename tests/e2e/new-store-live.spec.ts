import { expect, test } from '@playwright/test';
import {
  deleteStoreBySlug,
  deleteUser,
  freshEmail,
  grantAccess,
  randomMobile,
  signIn,
} from './helpers';
import { app, store as storeUrl } from './urls';

// Phase 5's exit criterion: a store goes from nothing to taking an order on
// its own subdomain using only the screens.
test('a new store goes from zero to its first order', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  page.setDefaultTimeout(10_000);
  const adminEmail = freshEmail(testInfo);
  const ownerEmail = `owner-${adminEmail}`;
  const slug = `e2e-live-${testInfo.project.name}-${Date.now()}`;
  const name = `Test ${slug.slice(-8)}`; // sorts after the demo stores
  const ownerContext = await browser.newContext();
  const shopperContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const shopper = await shopperContext.newPage();
  owner.setDefaultTimeout(10_000);
  shopper.setDefaultTimeout(10_000);
  try {
    // The super admin creates it.
    await signIn(page, adminEmail);
    await grantAccess(adminEmail, { superAdmin: true });
    await page.goto(app('/admin/tenants/new'));
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    await page.getByLabel('Store name').fill(name);
    await page.getByLabel('Address').fill(slug);
    await page.getByLabel('WhatsApp number for orders').fill('98765 43210');
    await page.getByLabel("Owner's email").fill(ownerEmail);
    await page.getByRole('button', { name: 'Create store' }).click();
    await expect(page).toHaveURL(/\/admin\/tenants\/[0-9a-f-]{36}$/);
    const adminUrl = page.url();

    // The owner adds a product and publishes the storefront.
    await signIn(owner, ownerEmail);
    await owner.goto(app('/dashboard/products/new'));
    await owner.getByLabel('Name', { exact: true }).fill('Rust Saree');
    await owner.getByLabel('Price (₹)', { exact: true }).fill('2,499');
    await owner.getByLabel(/^Stock for/).fill('3');
    await owner.getByLabel('Status', { exact: true }).selectOption('active');
    await owner.getByRole('button', { name: 'Add product' }).last().click();
    await expect(owner.getByText('Product added')).toBeVisible();
    await owner.goto(app('/dashboard/storefront'));
    await owner.locator('form[data-hydrated]').waitFor();
    await owner
      .getByTestId('publish-bar')
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(owner.getByTestId('publish-status')).toContainText('Live');

    // The super admin makes it live.
    await page.goto(adminUrl);
    const status = page.getByTestId('store-status-card');
    await expect(status).toHaveAttribute('data-hydrated');
    await status.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('store-status')).toHaveText('Live');
    await expect(page.getByTestId('billing-due')).toContainText('due');

    // A shopper orders.
    await shopper.route('https://wa.me/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }),
    );
    const open = async (path: string) => {
      await shopper.goto(storeUrl(slug, path));
      await shopper
        .locator('html[data-hydrated]')
        .waitFor({ state: 'attached' });
    };
    await open('/p/rust-saree');
    await shopper.getByRole('button', { name: 'Add to bag' }).click();
    await expect(shopper.getByTestId('cart-count')).toBeVisible();
    await open('/checkout');
    await shopper.getByLabel('Full name').fill('Asha Rao');
    await shopper.getByLabel('Mobile number').fill(randomMobile());
    await shopper.getByLabel('Address', { exact: true }).fill('12 MG Road');
    await shopper.getByLabel('City').fill('Bengaluru');
    await shopper.getByLabel('PIN code').fill('560001');
    await shopper.getByLabel('State').selectOption('Karnataka');
    await shopper
      .getByRole('button', { name: 'Place order on WhatsApp' })
      .click();
    await shopper.waitForURL(/^https:\/\/wa\.me\/919876543210/);

    // It reaches the owner.
    await owner.goto(app('/dashboard/orders'));
    await expect(
      owner.getByText('Asha Rao').filter({ visible: true }).first(),
    ).toBeVisible();
  } finally {
    await ownerContext.close();
    await shopperContext.close();
    await deleteStoreBySlug(slug);
    await deleteUser(ownerEmail);
    await deleteUser(adminEmail);
  }
});
