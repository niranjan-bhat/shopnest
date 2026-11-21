// Sign-in and access helpers shared by the dashboard specs.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { app, MAILPIT_URL } from './urls';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Test setup only: what a super admin will do through the UI in Phase 5. */
export async function grantAccess(
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
export function freshEmail(testInfo: TestInfo): string {
  const id = `${testInfo.project.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `e2e-${id}@example.com`;
}

/** Waits for the sign-in email in Mailpit and returns its 6-digit code. */
export async function signInCode(page: Page, email: string): Promise<string> {
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

export async function requestCode(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText(`We sent a 6-digit code to`)).toBeVisible();
}

/** Signs in through the UI and lands on the dashboard. */
export async function signIn(page: Page, email: string) {
  await page.goto(app('/login'));
  await requestCode(page, email);
  await page.getByLabel('Code').fill(await signInCode(page, email));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(app('/dashboard'));
}
