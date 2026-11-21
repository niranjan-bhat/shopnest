import { expect, test } from '@playwright/test';
import {
  freshEmail,
  grantAccess,
  requestCode,
  signIn,
  signInCode,
} from './helpers';
import { app } from './urls';

test.describe('sign-in', () => {
  test('signed-out visitors are sent to sign in, then back', async ({
    page,
  }, testInfo) => {
    await page.goto(app('/dashboard'));
    await expect(page).toHaveURL(app('/login?next=%2Fdashboard'));

    const email = freshEmail(testInfo);
    await requestCode(page, email);

    await page.getByLabel('Code').fill('000000');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'wrong or has expired',
    );

    await page.getByLabel('Code').fill(await signInCode(page, email));
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(app('/dashboard'));
    await expect(page.getByTestId('user-email')).toHaveText(email);
    // A new account belongs to no store until a super admin adds it.
    await expect(page.getByTestId('no-stores')).toBeVisible();
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Sign out' }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Super admin' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The admin area does not exist for ordinary users.
    await page.goto(app('/admin'));
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();

    await page.goto(app('/dashboard'));
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(app('/login'));
    await page.goto(app('/dashboard'));
    await expect(page).toHaveURL(app('/login?next=%2Fdashboard'));
  });

  test('members see their store; super admins see every store', async ({
    page,
  }, testInfo) => {
    const email = freshEmail(testInfo);
    await signIn(page, email);
    await expect(page.getByTestId('no-stores')).toBeVisible();

    await grantAccess(email, { store: 'saree-demo' });
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tara Weaves' }),
    ).toBeVisible();
    await expect(page.getByText('Noor Atelier')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'View store' }),
    ).toHaveAttribute('href', /^http:\/\/saree-demo\.localhost:\d+$/);

    await grantAccess(email, { superAdmin: true });
    await page.reload();
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Super admin' }).click();
    await expect(page).toHaveURL(app('/admin'));
    const stores = page.getByTestId('all-stores');
    await expect(stores).toContainText('Tara Weaves');
    await expect(stores).toContainText('Noor Atelier');
  });

  test('a bad email is rejected before anything is sent', async ({ page }) => {
    await page.goto(app('/login'));
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText(
      'Enter a valid email address',
    );
  });
});
