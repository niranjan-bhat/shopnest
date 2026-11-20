import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Tests that set up data (e.g. store memberships) need the local Supabase
// keys. CI sets them as environment variables instead.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const PORT = Number(process.env.PORT ?? 3000);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // Storefronts are mobile-first, so test a phone viewport as well as desktop.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster.
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
