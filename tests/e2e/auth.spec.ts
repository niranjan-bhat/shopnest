import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { app, MAILPIT_URL } from './urls';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Test setup only: what a super admin will do through the UI in Phase 5. */
async function grantAccess(
  email: string,
  access: { store?: string; superAdmin?: boolean },
) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY)
    throw new Error('Supabase env missing');
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user ${email}`);
  if (access.superAdmin) {
    const { error: e } = await db
      .from('profiles')
      .update({ is_super_admin: true })
      .eq('user_id', user.id);
    if (e) throw e;
  }
  if (access.store) {
    const { data: tenant, error: e1 } = await db
      .from('tenants')
      .select('id')
      .eq('slug', access.store)
      .single();
    if (e1) throw e1;
    const { error: e2 } = await db
      .from('tenant_members')
      .insert({ tenant_id: tenant.id, user_id: user.id, role: 'owner' });
    if (e2) throw e2;
  }
}

/** A fresh address per test and project, so runs never collide. */
function freshEmail(testInfo: TestInfo): string {
  const id = `${testInfo.project.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `e2e-${id}@example.com`;
}

/** Waits for the sign-in email in Mailpit and returns its 6-digit code. */
async function signInCode(page: Page, email: string): Promise<string> {
  let code = '';
  await expect
    .poll(
      async () => {
        const search = await page.request.get(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        const { messages } = (await search.json()) as {
          messages: { ID: string }[];
        };
        if (!messages?.length) return '';
        const message = await page.request.get(
          `${MAILPIT_URL}/api/v1/message/${messages[0].ID}`,
        );
        const { Text } = (await message.json()) as { Text: string };
        code = /\b(\d{6})\b/.exec(Text)?.[1] ?? '';
        return code;
      },
      { message: `sign-in email for ${email}`, timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

async function requestCode(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText(`We sent a 6-digit code to`)).toBeVisible();
}

/** Signs in through the UI and lands on the dashboard. */
async function signIn(page: Page, email: string) {
  await page.goto(app('/login'));
  await requestCode(page, email);
  await page.getByLabel('Code').fill(await signInCode(page, email));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(app('/dashboard'));
}

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
    await expect(
      page.getByRole('link', { name: 'Open super admin' }),
    ).toHaveCount(0);

    // The admin area does not exist for ordinary users.
    await page.goto(app('/admin'));
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();

    await page.goto(app('/dashboard'));
    await page.getByRole('button', { name: 'Sign out' }).click();
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
    await expect(page.getByText('Tara Weaves')).toBeVisible();
    await expect(page.getByText('Noor Atelier')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'View store' }),
    ).toHaveAttribute('href', /^http:\/\/saree-demo\.localhost:\d+$/);

    await grantAccess(email, { superAdmin: true });
    await page.reload();
    await page.getByRole('link', { name: 'Open super admin' }).click();
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
