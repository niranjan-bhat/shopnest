import type { Json, Tables } from '@/types/database';
import {
  fixtureId,
  fixtureStores,
  MEDIA_SIZE,
  mediaKey,
  type FixtureStore,
} from './fixtures.ts';

/**
 * The two demo stores as typed table rows, built from fixtures.ts.
 *
 * Since Phase 2 the app reads Supabase, not this. It is the single source for
 * supabase/seed.sql (scripts/generate-seed.mjs, run directly by Node, hence
 * the .ts import above) and for unit tests of the pure catalog code. App code
 * must not import it.
 */
export type MockDb = {
  tenants: Tables<'tenants'>[];
  tenant_domains: Tables<'tenant_domains'>[];
  tenant_themes: Tables<'tenant_themes'>[];
  categories: Tables<'categories'>[];
  products: Tables<'products'>[];
  product_categories: Tables<'product_categories'>[];
  product_variants: Tables<'product_variants'>[];
  product_images: Tables<'product_images'>[];
  banners: Tables<'banners'>[];
};

/** Fixed "now" so mock timestamps (and "newest" sorting) never drift. */
const MOCK_NOW = Date.UTC(2026, 10, 15, 10, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDaysAgo = (days: number) =>
  new Date(MOCK_NOW - days * DAY_MS).toISOString();

type JsonObject = { [key: string]: Json | undefined };

/** Round-trips through JSON so the value is a plain object like a jsonb column. */
function asJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function addStore(db: MockDb, store: FixtureStore): void {
  const tenantId = fixtureId(store.n, 'tenant', 1);

  db.tenants.push({
    id: tenantId,
    slug: store.slug,
    name: store.name,
    status: 'active',
    business_type: store.businessType,
    whatsapp_number: store.whatsapp,
    contact_email: store.contact.email,
    contact_phone: store.contact.phone,
    address: store.contact.address,
    opening_hours: store.contact.openingHours,
    currency: 'INR',
    created_at: isoDaysAgo(90),
    updated_at: isoDaysAgo(90),
  });

  db.tenant_domains.push({
    id: fixtureId(store.n, 'domain', 1),
    tenant_id: tenantId,
    hostname: store.hostname,
    kind: 'subdomain',
    is_primary: true,
    verified_at: isoDaysAgo(90),
    created_at: isoDaysAgo(90),
  });

  const theme = asJsonObject(store.theme);
  db.tenant_themes.push({
    tenant_id: tenantId,
    template_key: 'silk',
    draft: theme,
    published: theme,
    published_at: isoDaysAgo(30),
    updated_at: isoDaysAgo(30),
  });

  const categoryIds = new Map<string, string>();
  store.categories.forEach((category, i) => {
    const id = fixtureId(store.n, 'category', i + 1);
    categoryIds.set(category.slug, id);
    db.categories.push({
      id,
      tenant_id: tenantId,
      parent_id: null,
      name: category.name,
      slug: category.slug,
      position: i,
      image_key: mediaKey.category(tenantId, id),
      is_active: true,
      show_in_menu: true,
      created_at: isoDaysAgo(90),
      updated_at: isoDaysAgo(90),
    });
  });

  store.banners.forEach((banner, i) => {
    const id = fixtureId(store.n, 'banner', i + 1);
    db.banners.push({
      id,
      tenant_id: tenantId,
      image_key: mediaKey.banner(tenantId, id),
      heading: banner.heading,
      link: banner.link,
      position: i,
      starts_at: null,
      ends_at: null,
      created_at: isoDaysAgo(30),
      updated_at: isoDaysAgo(30),
    });
  });

  let variantIndex = 0;
  let imageIndex = 0;
  store.products.forEach((product, i) => {
    const productId = fixtureId(store.n, 'product', i + 1);
    const createdAt = isoDaysAgo(product.ageDays);

    db.products.push({
      id: productId,
      tenant_id: tenantId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price_mode: product.price === null ? 'on_request' : 'fixed',
      price_paise: product.price,
      compare_at_paise: product.compareAt ?? null,
      status: product.status ?? 'active',
      attributes: product.attributes,
      is_featured: product.featured ?? false,
      seo: {},
      created_at: createdAt,
      updated_at: createdAt,
    });

    for (const slug of product.categories) {
      const categoryId = categoryIds.get(slug);
      if (!categoryId) {
        throw new Error(`Unknown category "${slug}" on ${product.slug}`);
      }
      db.product_categories.push({
        product_id: productId,
        category_id: categoryId,
        tenant_id: tenantId,
      });
    }

    const variants = product.variants ?? [{ options: {}, stock: 6 }];
    variants.forEach((variant, v) => {
      variantIndex += 1;
      db.product_variants.push({
        id: fixtureId(store.n, 'variant', variantIndex),
        tenant_id: tenantId,
        product_id: productId,
        sku: `${store.slug.slice(0, 2).toUpperCase()}-${i + 1}-${v + 1}`,
        options: variant.options,
        price_paise: variant.price ?? null,
        stock_qty: variant.stock,
        track_inventory: true,
        created_at: createdAt,
        updated_at: createdAt,
      });
    });

    for (let n = 1; n <= product.images; n++) {
      imageIndex += 1;
      db.product_images.push({
        id: fixtureId(store.n, 'image', imageIndex),
        tenant_id: tenantId,
        product_id: productId,
        r2_key: mediaKey.product(tenantId, productId, n),
        alt: `${product.name}, view ${n}`,
        position: n - 1,
        width: MEDIA_SIZE.product.width,
        height: MEDIA_SIZE.product.height,
        created_at: createdAt,
      });
    }
  });
}

function buildMockDb(): MockDb {
  const db: MockDb = {
    tenants: [],
    tenant_domains: [],
    tenant_themes: [],
    categories: [],
    products: [],
    product_categories: [],
    product_variants: [],
    product_images: [],
    banners: [],
  };
  fixtureStores.forEach((store) => addStore(db, store));
  return db;
}

export const mockDb: MockDb = buildMockDb();
