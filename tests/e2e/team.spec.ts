import { expect, test } from '@playwright/test';
import {
  createStore,
  deleteStore,
  deleteUser,
  freshEmail,
  grantAccess,
  signIn,
} from './helpers';
import { app } from './urls';

test('a super admin builds a team; staff see what they may change', async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const adminEmail = freshEmail(testInfo);
  const ownerEmail = `owner-${adminEmail}`;
  const staffEmail = `staff-${adminEmail}`;
  const store = await createStore(testInfo);
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  try {
    await signIn(page, adminEmail);
    await grantAccess(adminEmail, { superAdmin: true });
    await page.goto(app(`/admin/tenants/${store.id}`));
    const card = page.getByTestId('team-card');
    await expect(card).toHaveAttribute('data-hydrated');

    const add = async (email: string, role: string) => {
      await card.getByLabel('Add someone by email').fill(email);
      await card.getByLabel('Role of the new person').selectOption(role);
      await card.getByRole('button', { name: 'Add to team' }).click();
    };
    const people = page.getByTestId('store-team').getByRole('listitem');
    await add(ownerEmail, 'owner');
    await expect(people).toHaveCount(1);
    await expect(card.getByLabel('Add someone by email')).toHaveValue('');
    await add(staffEmail, 'staff');
    await expect(people).toHaveCount(2);
    await add(staffEmail, 'staff');
    await expect(page.getByText('They are already on the team.')).toBeVisible();

    // Nobody is billed, so only the role decides what staff see.
    await signIn(staff, staffEmail);
    await expect(
      staff.getByRole('heading', { level: 1, name: store.name }),
    ).toBeVisible();
    const main = staff.getByRole('main');
    await expect(main.getByText('Add products')).toBeVisible();
    await expect(main.getByText('Brand your storefront')).toHaveCount(0);
    const menu = staff.getByRole('button', { name: 'Open menu' });
    if (testInfo.project.name === 'mobile') await menu.click();
    const nav = staff.getByRole('navigation', { name: 'Dashboard' });
    await expect(nav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Storefront' })).toHaveCount(0);
    for (const path of [
      '/dashboard/settings',
      '/dashboard/settings/pages/about',
      '/dashboard/storefront',
      '/preview',
    ]) {
      await staff.goto(app(path));
      await expect(staff).toHaveURL(app('/dashboard'));
    }
    await staff.goto(app('/dashboard/products/new'));
    await expect(staff.getByLabel('Name', { exact: true })).toBeVisible();

    // The only owner stays an owner, until someone else is one.
    const ownerRole = card.getByLabel(`Role of ${ownerEmail}`);
    const staffRole = card.getByLabel(`Role of ${staffEmail}`);
    await ownerRole.selectOption('staff');
    await expect(page.getByText('A store needs an owner.')).toBeVisible();
    await expect(ownerRole).toHaveValue('owner');
    await staffRole.selectOption('owner');
    await expect(staffRole).toHaveValue('owner');
    await expect(staffRole).toBeEnabled();
    await staff.goto(app('/dashboard/settings'));
    await expect(
      staff.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible();

    // Removed: gone on their next request.
    const row = people.filter({ hasText: staffEmail });
    await row.getByRole('button', { name: 'Remove…' }).click();
    await row.getByRole('button', { name: 'Remove access' }).click();
    await expect(people).toHaveCount(1);
    await staff.goto(app('/dashboard/settings'));
    await expect(staff.getByTestId('no-stores')).toBeVisible();
  } finally {
    await staffContext.close();
    await deleteStore(store);
    await deleteUser(staffEmail);
    await deleteUser(ownerEmail);
    await deleteUser(adminEmail);
  }
});
