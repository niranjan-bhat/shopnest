import { expect, test } from '@playwright/test';
import {
  createProducts,
  createStore,
  deleteStore,
  deleteUser,
  freshEmail,
  grantAccess,
  setStoreRow,
  signIn,
} from './helpers';
import { app, store as storeUrl } from './urls';

test('a store goes live, is suspended and comes back', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const email = freshEmail(testInfo);
  const store = await createStore(testInfo);
  const shopper = await (await browser.newContext()).newPage();
  const home = storeUrl(store.slug);
  const unavailable = shopper.getByRole('heading', {
    name: 'This store is currently unavailable',
  });
  try {
    await setStoreRow(store, { status: 'onboarding' });
    await signIn(page, email);
    await grantAccess(email, { superAdmin: true });
    await shopper.goto(home);
    await expect(
      shopper.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();

    // No products yet: not ready.
    await page.goto(app(`/admin/tenants/${store.id}`));
    const card = page.getByTestId('store-status-card');
    await expect(card).toHaveAttribute('data-hydrated');
    await expect(card.getByRole('button', { name: 'Go live' })).toBeDisabled();
    await createProducts(store, 1, 'active');
    await page.reload();
    await expect(card).toHaveAttribute('data-hydrated');
    await card.getByRole('button', { name: 'Go live' }).click();
    await expect(page.getByTestId('store-status')).toHaveText('Live');
    await shopper.goto(home);
    await expect(
      shopper
        .getByRole('banner')
        .getByText(store.name)
        .filter({ visible: true }),
    ).toBeVisible();

    // Suspended, with a reason.
    await card.getByRole('button', { name: 'Suspend…' }).click();
    const suspend = card.getByRole('button', { name: 'Suspend store' });
    await expect(suspend).toBeDisabled();
    await card.getByLabel('Reason').fill('Payment overdue');
    await suspend.click();
    await expect(page.getByTestId('store-status')).toHaveText('Suspended');
    await expect(async () => {
      await shopper.goto(home);
      await expect(unavailable).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await shopper.goto(storeUrl(store.slug, '/checkout'));
    await expect(unavailable).toBeVisible();

    // The dashboard says so.
    await page.getByRole('button', { name: 'View as merchant' }).click();
    await expect(page.getByTestId('suspended-banner')).toContainText(
      'Payment overdue',
    );

    await page.goto(app(`/admin/tenants/${store.id}`));
    await page.getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByTestId('store-status')).toHaveText('Live');
    await expect(async () => {
      await shopper.goto(home);
      await expect(
        shopper
          .getByRole('banner')
          .getByText(store.name)
          .filter({ visible: true }),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  } finally {
    await shopper.context().close();
    await deleteStore(store);
    await deleteUser(email);
  }
});

test('a super admin views a store read-only until they allow editing', async ({
  page,
}, testInfo) => {
  const email = freshEmail(testInfo);
  const store = await createStore(testInfo);
  try {
    await signIn(page, email);
    await grantAccess(email, { superAdmin: true });
    await page.goto(app(`/admin/tenants/${store.id}`));
    await page.getByRole('button', { name: 'View as merchant' }).click();
    const bar = page.getByTestId('admin-view-bar');
    await expect(bar).toContainText('Read only');

    const save = page.getByRole('button', { name: 'Save details' });
    const name = page.getByLabel('Store name');
    await page.goto(app('/dashboard/settings'));
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    await name.fill('Renamed by admin');
    await save.click();
    await expect(page.getByText('Read only. Choose')).toBeVisible();

    await bar
      .getByRole('button', { name: 'Allow editing for 30 minutes' })
      .click();
    await expect(bar).toContainText('Editing is allowed until');
    await save.click();
    await expect(
      page.getByText('Saved. Your store shows the new details.'),
    ).toBeVisible();

    await bar.getByRole('button', { name: 'Stop editing' }).click();
    await expect(bar).toContainText('Read only');
    await page.getByRole('link', { name: 'Back to admin' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Renamed by admin' }),
    ).toBeVisible();
  } finally {
    await deleteStore(store);
    await deleteUser(email);
  }
});
