import { expect, test } from '@playwright/test';
import { app, platform, store } from './urls';

test('each store host serves its own store from the database', async ({
  page,
}) => {
  await page.goto(store('saree-demo'));
  await expect(page).toHaveTitle('Tara Weaves');
  await page.goto(store('boutique-demo'));
  await expect(page).toHaveTitle('Noor Atelier');
});

test('the platform and each store have their own tab icon', async ({
  page,
  request,
}) => {
  const icon = page.locator('link[rel="icon"]');
  await page.goto(platform());
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute('href', /zarify-icon/);
  expect((await request.get(platform('/favicon.ico'))).ok()).toBe(true);
  await page.goto(store('saree-demo'));
  await expect(icon).toHaveCount(1);
  await expect(icon).not.toHaveAttribute('href', /zarify/);
});

test('internal /sites routes are not reachable directly', async ({
  request,
}) => {
  const direct = await request.get(platform('/sites/saree-demo.localhost'));
  expect(direct.status()).toBe(404);
});

test('app paths on the platform host go to the app host', async ({ page }) => {
  await page.goto(platform('/dashboard'));
  await expect(page).toHaveURL(app('/login?next=%2Fdashboard'));
});
