import { expect, test } from '@playwright/test';
import {
  createProducts,
  createStore,
  deletePlan,
  deleteStore,
  deleteUser,
  freshEmail,
  grantAccess,
  signIn,
} from './helpers';
import { app } from './urls';

test('plans, payments and limits', async ({ page, browser }, testInfo) => {
  test.slow();
  page.setDefaultTimeout(10_000);
  const adminEmail = freshEmail(testInfo);
  const ownerEmail = `owner-${adminEmail}`;
  const store = await createStore(testInfo);
  const planName = `Plan ${store.slug.slice(-12)}`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  try {
    await signIn(page, adminEmail);
    await grantAccess(adminEmail, { superAdmin: true });

    // A plan with room for one product.
    await page.goto(app('/admin/plans'));
    await page.getByRole('link', { name: 'New plan' }).click();
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    await page.getByLabel('Name').fill(planName);
    await page.getByLabel('Monthly fee (₹)').fill('abc');
    await page.getByLabel('Products').fill('1');
    await page.getByRole('button', { name: 'Save plan' }).click();
    await expect(page.getByText('Enter an amount in rupees')).toBeVisible();
    await page.getByLabel('Monthly fee (₹)').fill('1,499');
    await page.getByRole('button', { name: 'Save plan' }).click();
    await expect(
      page.getByTestId('plans').getByRole('link', { name: planName }),
    ).toContainText('₹1,499/month');

    // Billing started long ago: overdue.
    await page.goto(app(`/admin/tenants/${store.id}`));
    const billing = page.getByTestId('billing');
    await expect(billing).toHaveAttribute('data-hydrated');
    await expect(billing.getByTestId('billing-due')).toContainText(
      'Not billed',
    );
    await billing
      .getByLabel('Plan', { exact: true })
      .selectOption({ label: `${planName} (₹1,499/month)` });
    await billing.getByLabel('Billing starts').fill('2026-01-31');
    await billing.getByRole('button', { name: 'Save billing' }).click();
    const due = billing.getByTestId('billing-due');
    await expect(due).toContainText('due 31 Jan 2026');
    await expect(due).toContainText('Overdue');

    // The owner is told, and sees the plan.
    await signIn(owner, ownerEmail);
    await grantAccess(ownerEmail, { store: store.slug });
    await owner.goto(app('/dashboard/settings'));
    await expect(owner.getByTestId('overdue-banner')).toContainText(planName);
    await expect(owner.getByTestId('plan-card')).toContainText('0 of 1');

    // Payments: the amount follows the months.
    await billing.getByLabel('Months').fill('2');
    await expect(billing.getByLabel('Amount (₹)')).toHaveValue('2998');
    await billing.getByLabel('Reference').fill('UTR-42');
    await billing.getByRole('button', { name: 'Record payment' }).click();
    await expect(due).toContainText('due 31 Mar 2026');
    const payments = billing.getByRole('list', { name: 'Payments' });
    await expect(payments.getByRole('listitem')).toHaveCount(1);
    await expect(payments).toContainText('₹2,998');
    await expect(payments).toContainText('UTR-42');

    await payments.getByRole('button', { name: 'Void…' }).click();
    await payments.getByLabel('Reason for voiding').fill('Wrong store');
    await payments.getByRole('button', { name: 'Void payment' }).click();
    await expect(payments).toContainText('Voided: Wrong store');
    await expect(due).toContainText('due 31 Jan 2026');

    // The overdue tab finds it; paying far ahead clears it.
    await page.goto(app(`/admin?status=overdue&q=${store.slug}`));
    const list = page.getByTestId('all-stores').filter({ visible: true });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await list.getByRole('link').click();
    await expect(billing).toHaveAttribute('data-hydrated');
    await billing.getByLabel('Months').fill('24');
    await billing.getByRole('button', { name: 'Record payment' }).click();
    await expect(due).toContainText('due 31 Jan 2028');
    await expect(due).not.toContainText('Overdue');
    // Refreshing after a save must not duplicate the card above.
    await expect(page.getByTestId('store-status-card')).toHaveCount(1);
    await owner.reload();
    await expect(owner.getByTestId('plan-card')).toContainText('31 Jan 2028');
    await expect(owner.getByTestId('overdue-banner')).toHaveCount(0);

    // At the limit, adding a product says so.
    await owner.goto(app('/dashboard/products/new'));
    await expect(owner.getByLabel('Name', { exact: true })).toBeVisible();
    await createProducts(store, 1);
    await owner.reload();
    await expect(owner.getByTestId('product-limit')).toContainText(
      '1 of 1 products used',
    );

    // A retired plan keeps its stores but is not offered to new ones.
    await page.goto(app('/admin/plans'));
    await page
      .getByTestId('plans')
      .getByRole('link', { name: planName })
      .click();
    await expect(page.locator('form[data-hydrated]')).toBeVisible();
    await page.getByLabel('Offered to stores').uncheck();
    await page.getByRole('button', { name: 'Save plan' }).click();
    await expect(
      page.getByTestId('plans').getByRole('link', { name: planName }),
    ).toContainText('Retired');
    await page.goto(app('/admin/tenants/new'));
    await expect(
      page.getByLabel('Plan').getByRole('option', { name: planName }),
    ).toHaveCount(0);
    await owner.goto(app('/dashboard/settings'));
    await expect(owner.getByTestId('plan-card')).toContainText(planName);

    // Merchants cannot open plans.
    await owner.goto(app('/admin/plans'));
    await expect(
      owner.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  } finally {
    await ownerContext.close();
    await deleteStore(store);
    await deletePlan(planName);
    await deleteUser(ownerEmail).catch(() => {});
    await deleteUser(adminEmail);
  }
});
