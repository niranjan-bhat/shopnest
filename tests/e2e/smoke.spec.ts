import { expect, test } from '@playwright/test';
import { app, platform, store } from './urls';

test('platform index links to both demo stores on their own hosts', async ({
  page,
}) => {
  const response = await page.goto(platform());
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('link', { name: /Tara Weaves/ })).toHaveAttribute(
    'href',
    store('saree-demo').replace(/\/$/, ''),
  );
  await expect(page.getByRole('link', { name: /Noor Atelier/ })).toBeVisible();
});

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
