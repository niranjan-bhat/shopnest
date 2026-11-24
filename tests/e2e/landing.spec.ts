import { expect, test } from '@playwright/test';
import { createStore, deleteStore } from './helpers';
import { app, platform, store } from './urls';

test('the platform site leads to WhatsApp, the demos and sign-in', async ({
  page,
}) => {
  await page.goto(platform());
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /Your brand. Your store. Now online./,
  );
  const start = page.getByRole('link', { name: /^Get started/ });
  await expect(start).toHaveCount(4);
  for (const link of await start.all()) {
    await expect(link).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/919632531541\?text=Hi/,
    );
  }
  const demos = page.locator('#demos').getByRole('link');
  await expect(demos).toHaveCount(2);
  for (const [i, slug] of ['saree-demo', 'boutique-demo'].entries()) {
    await expect(demos.nth(i)).toHaveAttribute(
      'href',
      store(slug).replace(/\/$/, ''),
    );
  }
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    app('/login'),
  );
  await page.getByText('How do my customers pay?').click();
  await expect(page.getByText('UPI, bank transfer')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('merchants’ stores and plan prices are not listed', async ({
  page,
}, testInfo) => {
  const merchant = await createStore(testInfo);
  try {
    await page.goto(platform());
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.getByText(merchant.name)).toHaveCount(0);
    await expect(page.locator('#pricing')).not.toContainText('₹');
  } finally {
    await deleteStore(merchant);
  }
});

test('privacy, terms, sitemap and share image', async ({ page, request }) => {
  await page.goto(platform());
  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content');
  expect((await request.get(image ?? '')).ok()).toBe(true);
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveTitle('Privacy · Zarify');
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveTitle('Terms · Zarify');
  const sitemap = await (await request.get(platform('/sitemap.xml'))).text();
  expect(sitemap).toContain('/privacy');

  // The platform's card must not leak into stores.
  await page.goto(store('saree-demo'));
  await expect(page.locator('meta[content*="opengraph-image"]')).toHaveCount(0);
});
