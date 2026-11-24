import { expect, test, type Page } from '@playwright/test';
import { deleteUser, freshEmail, grantAccess, signIn } from './helpers';
import { app } from './urls';

/** Opens a dashboard section from the sidebar, or the menu on phones. */
async function openSection(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Dashboard' })
    .getByRole('link', { name })
    .click();
}

const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 1, name });

test.describe('dashboard shell', () => {
  test('signed-out visitors are sent to sign in from any section', async ({
    page,
  }) => {
    await page.goto(app('/dashboard/products'));
    await expect(page).toHaveURL(app('/login?next=%2Fdashboard%2Fproducts'));
  });

  test('users without a store are sent back to the overview', async ({
    page,
  }, testInfo) => {
    await signIn(page, freshEmail(testInfo));
    await page.goto(app('/dashboard/categories'));
    await expect(page).toHaveURL(app('/dashboard'));
    await expect(page.getByTestId('no-stores')).toBeVisible();
  });

  test('members move between sections of their store', async ({
    page,
  }, testInfo) => {
    const email = freshEmail(testInfo);
    await signIn(page, email);
    try {
      await grantAccess(email, { store: 'saree-demo' });
      await page.reload();

      await expect(heading(page, 'Tara Weaves')).toBeVisible();
      // One store: its name, no switcher.
      await expect(page.getByTestId('store-name')).toHaveText('Tara Weaves');
      await expect(
        page.getByRole('button', { name: /Switch store/ }),
      ).toHaveCount(0);

      await openSection(page, 'Products');
      await expect(page).toHaveURL(app('/dashboard/products'));
      await expect(heading(page, 'Products')).toBeVisible();

      await openSection(page, 'Settings');
      await expect(page).toHaveURL(app('/dashboard/settings'));
      await expect(heading(page, 'Settings')).toBeVisible();

      await openSection(page, 'Overview');
      await expect(heading(page, 'Tara Weaves')).toBeVisible();
    } finally {
      // The demo store's plan limits how many people it has.
      await deleteUser(email);
    }
  });

  test('super admins switch between every store', async ({
    page,
  }, testInfo) => {
    const email = freshEmail(testInfo);
    await signIn(page, email);
    await grantAccess(email, { superAdmin: true });
    await page.reload();

    // Not a member anywhere: stores are listed by name.
    await expect(heading(page, 'Noor Atelier')).toBeVisible();
    await expect(
      page.getByText('You are viewing this store as a super admin.'),
    ).toBeVisible();

    await page.getByRole('button', { name: /Switch store/ }).click();
    await page.getByRole('menuitem', { name: 'Tara Weaves' }).click();
    await expect(heading(page, 'Tara Weaves')).toBeVisible();

    // The choice is remembered.
    await page.reload();
    await expect(heading(page, 'Tara Weaves')).toBeVisible();
  });
});
