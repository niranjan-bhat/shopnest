import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { check } from '@/lib/supabase/result';
import { storefrontDb } from '@/lib/supabase/storefront';
import type { Tables } from '@/types/database';
import {
  toBanner,
  toCatalogItem,
  toCategory,
  toProductDetail,
  type ProductRows,
} from './mappers';
import type {
  Banner,
  CatalogItem,
  CategorySummary,
  ProductDetail,
} from './types';

// Public storefront reads. They use the anonymous client, so RLS already
// limits them to live data; every query still filters by tenant_id
// explicitly. Results are cached per tenant and invalidated with
// revalidateTag(catalogTag(tenantId)) when the merchant saves (Phase 3).

export const catalogTag = (tenantId: string) => `tenant:${tenantId}:catalog`;

function cacheCatalog(tenantId: string) {
  cacheLife('hours');
  cacheTag(catalogTag(tenantId));
}

async function activeCategoryRows(
  tenantId: string,
): Promise<Tables<'categories'>[]> {
  return check(
    await storefrontDb()
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('position')
      .order('name'),
    'categories',
  );
}

/**
 * Active products with their variants, images and categories. With a slug,
 * just that product; otherwise the whole catalog.
 */
async function productRows(
  tenantId: string,
  slug?: string,
): Promise<ProductRows[]> {
  const db = storefrontDb();
  let productQuery = db
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (slug !== undefined) productQuery = productQuery.eq('slug', slug);
  const products = check(await productQuery, 'products');
  if (products.length === 0) return [];

  let variantQuery = db
    .from('product_variants')
    .select('*')
    .eq('tenant_id', tenantId);
  let imageQuery = db
    .from('product_images')
    .select('*')
    .eq('tenant_id', tenantId);
  let linkQuery = db
    .from('product_categories')
    .select('*')
    .eq('tenant_id', tenantId);
  // For one product, fetch only its children. For the whole catalog the
  // tenant filter is enough, and keeps the request URL short.
  if (slug !== undefined) {
    const ids = products.map((p) => p.id);
    variantQuery = variantQuery.in('product_id', ids);
    imageQuery = imageQuery.in('product_id', ids);
    linkQuery = linkQuery.in('product_id', ids);
  }

  const [variantResult, imageResult, linkResult, categories] =
    await Promise.all([
      // Variants keep the order they were created in (sizes are re-sorted
      // for display anyway).
      variantQuery.order('created_at').order('id'),
      imageQuery.order('position'),
      linkQuery,
      activeCategoryRows(tenantId),
    ]);
  const variants = check(variantResult, 'product_variants');
  const images = check(imageResult, 'product_images');
  const links = check(linkResult, 'product_categories');

  const byProduct = <T extends { product_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.product_id);
      if (list) list.push(row);
      else map.set(row.product_id, [row]);
    }
    return map;
  };
  const variantsBy = byProduct(variants);
  const imagesBy = byProduct(images);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoriesBy = new Map<string, Tables<'categories'>[]>();
  for (const link of links) {
    const category = categoryById.get(link.category_id);
    if (!category) continue;
    const list = categoriesBy.get(link.product_id) ?? [];
    list.push(category);
    categoriesBy.set(link.product_id, list);
  }

  return products.map((product) => ({
    product,
    variants: variantsBy.get(product.id) ?? [],
    images: imagesBy.get(product.id) ?? [],
    categories: (categoriesBy.get(product.id) ?? []).sort(
      (a, b) => a.position - b.position,
    ),
  }));
}

export async function listCategories(
  tenantId: string,
): Promise<CategorySummary[]> {
  'use cache';
  cacheCatalog(tenantId);
  return (await activeCategoryRows(tenantId)).map(toCategory);
}

export async function getCategoryBySlug(
  tenantId: string,
  slug: string,
): Promise<CategorySummary | null> {
  'use cache';
  cacheCatalog(tenantId);
  const row = check(
    await storefrontDb()
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('slug', slug)
      .maybeSingle(),
    'category',
  );
  return row ? toCategory(row) : null;
}

export async function listBanners(tenantId: string): Promise<Banner[]> {
  'use cache';
  cacheCatalog(tenantId);
  const rows = check(
    await storefrontDb()
      .from('banners')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position'),
    'banners',
  );
  return rows.map(toBanner);
}

/** Every active product as a card with filter fields, unsorted. */
export async function listCatalogItems(
  tenantId: string,
): Promise<CatalogItem[]> {
  'use cache';
  cacheCatalog(tenantId);
  return (await productRows(tenantId)).map(toCatalogItem);
}

export async function getProductBySlug(
  tenantId: string,
  slug: string,
): Promise<ProductDetail | null> {
  'use cache';
  cacheCatalog(tenantId);
  const [rows] = await productRows(tenantId, slug);
  return rows ? toProductDetail(rows) : null;
}
