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

/**
 * Replaces a test store's home sections (draft and live). Call it before the
 * store's pages are first visited: they are cached afterwards.
 */
export async function setHomeSections(store: TestStore, sections: unknown[]) {
  const db = adminDb();
  const { data, error } = await db
    .from('tenant_themes')
    .select('published')
    .eq('tenant_id', store.id)
    .single();
  if (error) throw error;
  const theme = { ...(data.published as object), sections };
  const { error: updateError } = await db
    .from('tenant_themes')
    .update({ draft: theme, published: theme })
    .eq('tenant_id', store.id);
  if (updateError) throw updateError;
}

/**
 * Adds always-shown banners with these headings, in order. Their image keys
 * point at no real file: enough for tests that do not look at the photos.
 */
export async function createBanners(
  store: TestStore,
  headings: string[],
): Promise<string[]> {
  const { data, error } = await adminDb()
    .from('banners')
    .insert(
      headings.map((heading, position) => ({
        tenant_id: store.id,
        image_key: `tenants/${store.id}/banners/${crypto.randomUUID()}.webp`,
        heading,
        position,
      })),
    )
    .select('id, position')
    .order('position');
  if (error) throw error;
  return data.map((b) => b.id);
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

/**
 * Adds products "Product 01".."Product NN" (draft unless `status` says
 * otherwise; one variant each), with
 * "Product 01" the most recently changed, so it lists first.
 */
export async function createProducts(
  store: TestStore,
  count: number,
  status: 'draft' | 'active' = 'draft',
) {
  const db = adminDb();
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      tenant_id: store.id,
      name: `Product ${n}`,
      slug: `product-${n}`,
      price_mode: 'fixed' as const,
      price_paise: 100000,
      status,
      updated_at: new Date(now - i * 60_000).toISOString(),
    };
  });
  const { data, error } = await db.from('products').insert(rows).select('id');
  if (error) throw error;
  const { error: variantError } = await db.from('product_variants').insert(
    data.map((p) => ({
      tenant_id: store.id,
      product_id: p.id,
      stock_qty: 1,
    })),
  );
  if (variantError) throw variantError;
}

/**
 * A fresh Indian mobile number (10 digits) for a checkout, so repeated runs
 * stay under place_order's limit of 3 orders an hour per phone per store.
 */
export function randomMobile(): string {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

/** Changes a store's product behind the shopper's back (price, status). */
export async function updateProduct(
  store: TestStore,
  productSlug: string,
  patch: {
    price_paise?: number | null;
    price_mode?: 'fixed' | 'on_request';
    status?: 'draft' | 'active';
  },
) {
  const { error } = await adminDb()
    .from('products')
    .update(patch)
    .eq('tenant_id', store.id)
    .eq('slug', productSlug);
  if (error) throw error;
}

/**
 * Places an order as the checkout would (place_order with the service
 * role), at today's prices. Returns its order number.
 */
export async function placeOrder(
  store: TestStore,
  lines: { productSlug: string; qty: number }[],
  customer = 'Asha Rao',
): Promise<number> {
  const db = adminDb();
  const items = [];
  for (const line of lines) {
    const { data, error } = await db
      .from('products')
      .select('price_mode, price_paise, product_variants(id)')
      .eq('tenant_id', store.id)
      .eq('slug', line.productSlug)
      .single();
    if (error) throw error;
    items.push({
      variant_id: data.product_variants[0]!.id,
      qty: line.qty,
      unit_price_paise: data.price_mode === 'fixed' ? data.price_paise : null,
    });
  }
  const { data, error } = await db.rpc('place_order', {
    tid: store.id,
    checkout: crypto.randomUUID(),
    customer: {
      name: customer,
      phone: '+919876543210',
      notes: 'Please call before delivery',
      address: {
        line1: '12 MG Road',
        line2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    },
    items,
  });
  if (error) throw error;
  const result = data as { status: string; order_number?: number };
  if (result.status !== 'placed') throw new Error(JSON.stringify(result));
  return result.order_number!;
}

/** Changes a (single-variant) product's stock behind the app's back. */
export async function setStock(
  store: TestStore,
  productSlug: string,
  stock: number,
) {
  const db = adminDb();
  const { data, error } = await db
    .from('products')
    .select('id')
    .eq('tenant_id', store.id)
    .eq('slug', productSlug)
    .single();
  if (error) throw error;
  const { error: e } = await db
    .from('product_variants')
    .update({ stock_qty: stock })
    .eq('tenant_id', store.id)
    .eq('product_id', data.id);
  if (e) throw e;
}

/** Units in stock of a store's (single-variant) product. */
export async function stockOf(
  store: TestStore,
  productSlug: string,
): Promise<number> {
  const { data, error } = await adminDb()
    .from('products')
    .select('product_variants(stock_qty)')
    .eq('tenant_id', store.id)
    .eq('slug', productSlug)
    .single();
  if (error) throw error;
  return data.product_variants[0]!.stock_qty;
}

/** A store's orders with their lines, newest first. */
export async function listOrders(store: TestStore) {
  const { data, error } = await adminDb()
    .from('orders')
    .select(
      'order_number, total_paise, order_items(name_snapshot, unit_price_paise, qty)',
    )
    .eq('tenant_id', store.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
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

/** How many emails Mailpit holds for an address. */
export async function emailCount(page: Page, email: string): Promise<number> {
  const search = await page.request.get(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const { messages } = (await search.json()) as { messages: unknown[] };
  return messages?.length ?? 0;
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
  await expect(page.getByText("we've sent it a 6-digit code")).toBeVisible();
}

/**
 * Makes an account with no store. It is a super admin until the returned
 * function runs: only people with access are sent a code.
 */
export async function createAccount(
  email: string,
): Promise<() => Promise<void>> {
  const db = adminDb();
  const { data, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  const setAdmin = async (is_super_admin: boolean) => {
    const { error: e } = await db
      .from('profiles')
      .update({ is_super_admin })
      .eq('user_id', userId);
    if (e) throw e;
  };
  await setAdmin(true);
  return () => setAdmin(false);
}

export async function hasAccount(email: string): Promise<boolean> {
  const { data, error } = await adminDb().auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  return data.users.some((u) => u.email === email);
}

/**
 * Signs in through the UI and lands on the dashboard. An email without an
 * account gets one, with no store.
 */
export async function signIn(page: Page, email: string) {
  const dropAccess = (await hasAccount(email))
    ? undefined
    : await createAccount(email);
  await page.goto(app('/login'));
  await requestCode(page, email);
  const code = await signInCode(page, email);
  await dropAccess?.();
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(app('/dashboard'));
}

export async function deleteStoreBySlug(slug: string) {
  const { error } = await adminDb().from('tenants').delete().eq('slug', slug);
  if (error) throw error;
}

/** Changes a test store's own row, e.g. its status. */
export async function setStoreRow(store: TestStore, row: object) {
  const { error } = await adminDb()
    .from('tenants')
    .update(row)
    .eq('id', store.id);
  if (error) throw error;
}

export async function deletePlan(name: string) {
  const { error } = await adminDb().from('plans').delete().eq('name', name);
  if (error) throw error;
}

/** Gives a store's product colours (10 of each) and photos tagged with them. */
export async function addColours(
  store: TestStore,
  productSlug: string,
  colours: string[],
  photos: (string | null)[],
): Promise<string[]> {
  const db = adminDb();
  const { data: product, error } = await db
    .from('products')
    .select('id')
    .eq('tenant_id', store.id)
    .eq('slug', productSlug)
    .single();
  if (error) throw error;
  const owner = { tenant_id: store.id, product_id: product.id };
  const { error: e1 } = await db.from('product_variants').delete().match(owner);
  if (e1) throw e1;
  const { error: e2 } = await db.from('product_variants').insert(
    colours.map((colour, position) => ({
      ...owner,
      options: { colour },
      stock_qty: 10,
      position,
    })),
  );
  if (e2) throw e2;
  // The files need not exist: tests look at which photos are shown.
  const keys = photos.map(
    (_, i) => `tenants/${store.id}/products/${product.id}/photo-${i + 1}.webp`,
  );
  const { error: e3 } = await db.from('product_images').insert(
    photos.map((colour, i) => ({
      ...owner,
      r2_key: keys[i],
      position: i,
      colour,
    })),
  );
  if (e3) throw e3;
  return keys;
}

/** Links a store's product to a new category. */
export async function linkCategory(
  store: TestStore,
  productSlug: string,
  categorySlug: string,
) {
  const db = adminDb();
  const product = await db
    .from('products')
    .select('id')
    .eq('tenant_id', store.id)
    .eq('slug', productSlug)
    .single();
  if (product.error) throw product.error;
  const category = await db
    .from('categories')
    .select('id')
    .eq('tenant_id', store.id)
    .eq('slug', categorySlug)
    .single();
  if (category.error) throw category.error;
  const { error } = await db.from('product_categories').insert({
    tenant_id: store.id,
    product_id: product.data.id,
    category_id: category.data.id,
  });
  if (error) throw error;
}
