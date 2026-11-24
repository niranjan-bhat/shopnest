import { expect, test } from '@playwright/test';
import {
  deleteStoreBySlug,
  deleteUser,
  freshEmail,
  grantAccess,
  requestCode,
  signIn,
  signInCode,
} from './helpers';
import { app, store } from './urls';

test('a super admin creates a store and its owner signs in', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const adminEmail = freshEmail(testInfo);
  const ownerEmail = `owner-${adminEmail}`;
  const slug = `e2e-new-${testInfo.project.name}-${Date.now()}`;
  const name = slug.replaceAll('-', ' ');

  try {
    await signIn(page, adminEmail);
    await grantAccess(adminEmail, { superAdmin: true });

    // Visit the address first, so "no store here" is cached.
    await page.goto(store(slug));
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();

    await page.goto(app('/admin'));
    await page.getByRole('link', { name: 'New store' }).click();
    await expect(page.locator('form[data-hydrated]')).toBeVisible();

    // A reserved address is refused straight away.
    await page.getByLabel('Store name').fill(name);
    await expect(page.getByLabel('Address')).toHaveValue(slug);
    await page.getByLabel('Address').fill('mail');
    await page.getByLabel('WhatsApp number for orders').fill('98765 43210');
    await page.getByLabel("Owner's email").fill(ownerEmail);
    await page.getByRole('button', { name: 'Create store' }).click();
    await expect(page.getByText('This address is reserved')).toBeVisible();

    // So is one in use.
    await page.getByLabel('Address').fill('saree-demo');
    await page.getByRole('button', { name: 'Create store' }).click();
    await expect(page.getByText('This address is taken')).toBeVisible();

    await page.getByLabel('Address').fill(slug);
    await page.getByRole('button', { name: 'Create store' }).click();
    await expect(page).toHaveURL(/\/admin\/tenants\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(
      page.getByTestId('store-status').filter({ visible: true }),
    ).toHaveText('Not live yet');
    await expect(page.getByTestId('store-team')).toContainText(ownerEmail);
    const invite = page.getByTestId('owner-invite');
    await expect(invite).toContainText(app('/login'));
    await expect(
      invite.getByRole('link', { name: 'Send on WhatsApp' }),
    ).toHaveAttribute('href', /^https:\/\/wa\.me\/919876543210\?text=/);

    // It is in the list, and shoppers cannot see it.
    await page.goto(app(`/admin?status=onboarding&q=${slug}`));
    await expect(
      page.getByTestId('all-stores').getByRole('listitem'),
    ).toHaveCount(1);
    await page.goto(store(slug));
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();

    // The owner signs in with a code and lands on the new store, with a
    // theme ready to edit.
    const context = await browser.newContext();
    const owner = await context.newPage();
    await owner.goto(app('/login'));
    await requestCode(owner, ownerEmail);
    await owner.getByLabel('Code').fill(await signInCode(owner, ownerEmail));
    await owner.getByRole('button', { name: 'Sign in' }).click();
    await expect(owner.getByRole('heading', { level: 1, name })).toBeVisible();
    await owner.goto(app('/dashboard/storefront'));
    await expect(owner.getByTestId('publish-status')).toBeVisible();
    await owner.goto(app('/admin'));
    await expect(
      owner.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    await context.close();

    // Once they have signed in there is nobody left to invite.
    await page.goto(app(`/admin?q=${slug}`));
    await page.getByTestId('all-stores').getByRole('link').click();
    await expect(page.getByTestId('store-team')).toContainText(ownerEmail);
    await expect(page.getByTestId('owner-invite')).toHaveCount(0);
  } finally {
    await deleteStoreBySlug(slug);
    await deleteUser(ownerEmail);
    await deleteUser(adminEmail);
  }
});
