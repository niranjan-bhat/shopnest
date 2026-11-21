// Sign-in and access helpers shared by the dashboard specs.
import { expect, type Page, type TestInfo } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { app, MAILPIT_URL } from './urls';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Service-role client for test setup (bypasses RLS). */
function adminDb() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY)
    throw new Error('Supabase env missing');
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestStore = { id: string; slug: string; name: string };

/**
 * A live store of its own for a test that changes catalog data, so it never
 * disturbs the seeded demo stores other tests read. It copies the saree
 * demo's published theme and lives on <slug>.localhost. Delete it with
 * deleteStore when the test ends.
 */
export async function createStore(testInfo: TestInfo): Promise<TestStore> {
  const db = adminDb();
  const slug = `e2e-${testInfo.project.name}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const name = `Test store ${slug.slice(-8)}`;
  const { data: tenant, error } = await db
    .from('tenants')
    .insert({ slug, name, status: 'active', whatsapp_number: '+919800000000' })
    .select('id')
    .single();
  if (error) throw error;
  const { error: domainError } = await db.from('tenant_domains').insert({
    tenant_id: tenant.id,
    hostname: `${slug}.localhost`,
    kind: 'subdomain',
    is_primary: true,
  });
  if (domainError) throw domainError;
  const { data: demo, error: demoError } = await db
    .from('tenant_themes')
    .select('template_key, published, tenants!inner(slug)')
    .eq('tenants.slug', 'saree-demo')
    .single();
  if (demoError) throw demoError;
  const { error: themeError } = await db.from('tenant_themes').insert({
    tenant_id: tenant.id,
    template_key: demo.template_key,
    draft: demo.published,
    published: demo.published,
  });
  if (themeError) throw themeError;
  return { id: tenant.id, slug, name };
}

/** Adds a visible menu category to a test store. */
export async function createCategory(
  store: TestStore,
  name: string,
  slug: string,
) {
  const { error } = await adminDb().from('categories').insert({
    tenant_id: store.id,
    name,
    slug,
    show_in_menu: true,
  });
  if (error) throw error;
}

/** Variant ids of a store's product, by option label (e.g. "Rust · S"). */
export async function variantIds(
  store: TestStore,
  productSlug: string,
): Promise<Record<string, string>> {
  const { data, error } = await adminDb()
    .from('products')
    .select('product_variants(id, options)')
    .eq('tenant_id', store.id)
    .eq('slug', productSlug)
    .single();
  if (error) throw error;
  return Object.fromEntries(
    data.product_variants.map((v) => {
      const options = v.options as Record<string, string>;
      return [[options.colour, options.size].filter(Boolean).join(' · '), v.id];
    }),
  );
}

export async function deleteStore(store: TestStore) {
  const { error } = await adminDb().from('tenants').delete().eq('id', store.id);
  if (error) throw error;
}

/** Test setup only: what a super admin will do through the UI in Phase 5. */
export async function grantAccess(
  email: string,
  access: { store?: string; superAdmin?: boolean },
) {
  const db = adminDb();
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
async function userIdFor(email: string): Promise<string> {
  const { data, error } = await adminDb().auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user ${email}`);
  return user.id;
}

/** Takes a user out of a store (what removing a team member will do). */
export async function revokeStore(email: string, storeSlug: string) {
  const db = adminDb();
  const userId = await userIdFor(email);
  const { data: tenant, error } = await db
    .from('tenants')
    .select('id')
    .eq('slug', storeSlug)
    .single();
  if (error) throw error;
  const { error: e } = await db
    .from('tenant_members')
    .delete()
    .eq('tenant_id', tenant.id)
    .eq('user_id', userId);
  if (e) throw e;
}

/** Deletes the account entirely, as from the Supabase dashboard. */
export async function deleteUser(email: string) {
  const { error } = await adminDb().auth.admin.deleteUser(
    await userIdFor(email),
  );
  if (error) throw error;
}

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
