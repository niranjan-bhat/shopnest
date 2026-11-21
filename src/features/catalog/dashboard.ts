import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { toRupeesInput } from '@/lib/money';
import {
  CLOTHING_ATTRIBUTE_KEYS,
  type ClothingAttributeKey,
} from './attributes';
import { toStringRecord } from './mappers';
import {
  emptyProductForm,
  PRODUCT_PAGE_SIZE,
  type ProductFormValues,
  type ProductStatus,
} from './product-schema';
import type { MediaImage } from './types';
import {
  buildVariants,
  optionListsOf,
  type VariantDraft,
} from './variant-builder';

// Catalog reads for the merchant dashboard. They run as the signed-in user
// (RLS applies), include hidden and draft rows, are never cached, and filter
// by tenant_id explicitly.

export type DashboardCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  showInMenu: boolean;
  /** Products linked to the category, whatever their status. */
  productCount: number;
};

export async function listDashboardCategories(
  tenantId: string,
): Promise<DashboardCategory[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('categories')
      .select(
        'id, name, slug, is_active, show_in_menu, product_categories(count)',
      )
      .eq('tenant_id', tenantId)
      .order('position')
      .order('name'),
    'categories',
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    showInMenu: row.show_in_menu,
    productCount: row.product_categories[0]?.count ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductListFilter = {
  status: ProductStatus | 'all';
  /** Matches anywhere in the name, ignoring case. */
  search: string;
  /** 1-based. */
  page: number;
};

export type ProductPage = {
  products: DashboardProduct[];
  /** Products matching the filter, across all pages. */
  total: number;
};

export type DashboardProduct = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  isFeatured: boolean;
  /** Lowest and highest variant price; null when the price is on request. */
  price: { min: number; max: number } | null;
  /** Units across variants that track stock; null if none track it. */
  stock: number | null;
  variantCount: number;
  image: MediaImage | null;
  categories: string[];
};

export type ProductCounts = Record<ProductStatus | 'all', number>;

/** `%` and `_` are wildcards in ILIKE (and `\` escapes); match them literally. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** PostgREST's answer to a page past the end ("range not satisfiable"). */
const PAST_LAST_PAGE = 'PGRST103';

/**
 * One page of the store's products (most recently changed first) and how
 * many match in total. A page past the end comes back empty, with the total,
 * so the list can link back to the last page.
 */
export async function listDashboardProducts(
  tenantId: string,
  filter: ProductListFilter,
): Promise<ProductPage> {
  const supabase = await createServerSupabase();
  const from = (filter.page - 1) * PRODUCT_PAGE_SIZE;
  let query = supabase
    .from('products')
    .select(
      `id, name, slug, status, is_featured, price_mode, price_paise,
       product_variants(stock_qty, track_inventory, price_paise),
       product_images(r2_key, alt, width, height, position),
       product_categories(categories(name))`,
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    // A tiebreaker, so pages never repeat or skip rows saved together.
    .order('id')
    .order('position', { referencedTable: 'product_images' })
    .limit(1, { referencedTable: 'product_images' })
    .range(from, from + PRODUCT_PAGE_SIZE - 1);
  if (filter.status !== 'all') query = query.eq('status', filter.status);
  if (filter.search) query = query.ilike('name', likePattern(filter.search));
  const result = await query;

  if (result.error?.code === PAST_LAST_PAGE) {
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (filter.status !== 'all') {
      countQuery = countQuery.eq('status', filter.status);
    }
    if (filter.search) {
      countQuery = countQuery.ilike('name', likePattern(filter.search));
    }
    return { products: [], total: countOf(await countQuery, 'products') };
  }
  const rows = check(result, 'products');

  const products = rows.map((row) => {
    const variants = row.product_variants;
    const prices =
      row.price_mode === 'on_request'
        ? []
        : variants
            .map((v) => v.price_paise ?? row.price_paise)
            .filter((p): p is number => p !== null);
    const tracked = variants.filter((v) => v.track_inventory);
    const image = row.product_images[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      isFeatured: row.is_featured,
      price:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      stock:
        tracked.length > 0
          ? tracked.reduce((sum, v) => sum + v.stock_qty, 0)
          : null,
      variantCount: variants.length,
      image: image
        ? {
            key: image.r2_key,
            alt: image.alt ?? row.name,
            width: image.width ?? 900,
            height: image.height ?? 1200,
          }
        : null,
      categories: row.product_categories
        .map((link) => link.categories?.name)
        .filter((name): name is string => Boolean(name)),
    };
  });
  return { products, total: result.count ?? products.length };
}

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

function countOf(result: CountResult, what: string): number {
  if (result.error) {
    throw new Error(
      `Supabase query failed (${what}): ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.count ?? 0;
}

/** How many products each status tab holds (counted by the database). */
export async function countDashboardProducts(
  tenantId: string,
): Promise<ProductCounts> {
  const supabase = await createServerSupabase();
  const count = (status?: ProductStatus) => {
    let query = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (status) query = query.eq('status', status);
    return query;
  };
  const [all, draft, active, archived] = await Promise.all([
    count(),
    count('draft'),
    count('active'),
    count('archived'),
  ]);
  return {
    all: countOf(all, 'products'),
    draft: countOf(draft, 'products'),
    active: countOf(active, 'products'),
    archived: countOf(archived, 'products'),
  };
}

export type DashboardImage = {
  id: string;
  key: string;
  alt: string;
  width: number;
  height: number;
};

export type ProductForEdit = {
  id: string;
  slug: string;
  status: ProductStatus;
  /** Changes on every save; the form restarts from fresh data then. */
  updatedAt: string;
  /** In display order; the first is the cover. */
  images: DashboardImage[];
  values: ProductFormValues;
};

/** A product as the edit form needs it, or null if it is not this store's. */
export async function getProductForEdit(
  tenantId: string,
  productId: string,
): Promise<ProductForEdit | null> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('products')
      .select(
        `*, product_variants(*), product_categories(category_id),
         product_images(id, r2_key, alt, width, height, position)`,
      )
      .eq('tenant_id', tenantId)
      .eq('id', productId)
      .order('created_at', { referencedTable: 'product_variants' })
      .order('position', { referencedTable: 'product_images' })
      .maybeSingle(),
    'product',
  );
  if (!row) return null;

  const stored = toStringRecord(row.attributes);
  const attributes = emptyProductForm().attributes;
  const extraDetails: ProductFormValues['extraDetails'] = [];
  for (const [key, value] of Object.entries(stored)) {
    if ((CLOTHING_ATTRIBUTE_KEYS as readonly string[]).includes(key)) {
      attributes[key as ClothingAttributeKey] = value;
    } else {
      extraDetails.push({ label: key, value });
    }
  }
  extraDetails.sort((a, b) => a.label.localeCompare(b.label));

  // Only size and colour options are edited here (all the storefront uses).
  const saved: VariantDraft[] = row.product_variants.map((variant) => {
    const options = toStringRecord(variant.options);
    return {
      id: variant.id,
      options: {
        ...(options.colour ? { colour: options.colour } : {}),
        ...(options.size ? { size: options.size } : {}),
      },
      sku: variant.sku ?? '',
      price:
        variant.price_paise === null ? '' : toRupeesInput(variant.price_paise),
      stock: String(variant.stock_qty),
      trackInventory: variant.track_inventory,
    };
  });
  const lists = optionListsOf(saved);
  const seo = toStringRecord(row.seo);

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    images: row.product_images.map((image) => ({
      id: image.id,
      key: image.r2_key,
      alt: image.alt ?? '',
      width: image.width ?? 900,
      height: image.height ?? 1200,
    })),
    values: {
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      status: row.status,
      isFeatured: row.is_featured,
      priceMode: row.price_mode,
      price: row.price_paise === null ? '' : toRupeesInput(row.price_paise),
      compareAt:
        row.compare_at_paise === null
          ? ''
          : toRupeesInput(row.compare_at_paise),
      categoryIds: row.product_categories.map((link) => link.category_id),
      attributes,
      extraDetails,
      sizes: lists.sizes,
      colours: lists.colours,
      variants: buildVariants(lists, saved),
      seoTitle: seo.title ?? '',
      seoDescription: seo.description ?? '',
    },
  };
}
