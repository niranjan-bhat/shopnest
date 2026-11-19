import { expect, test } from '@playwright/test';

test('index lists both demo stores', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('link', { name: /Tara Weaves/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Noor Atelier/ })).toBeVisible();
});
