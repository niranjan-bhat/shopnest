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
