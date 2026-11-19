import { cacheLife, cacheTag } from 'next/cache';
import { mockDb } from '@/mocks';
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

// Phase 1 reads the in-memory mock tables; Phase 2 swaps these bodies for
// Supabase queries with the same signatures. Every query takes tenantId and
// filters on it explicitly.

export const catalogTag = (tenantId: string) => `tenant:${tenantId}:catalog`;

function cacheCatalog(tenantId: string) {
  cacheLife('hours');
  cacheTag(catalogTag(tenantId));
}

function activeCategoryRows(tenantId: string): Tables<'categories'>[] {
  return mockDb.categories
    .filter((c) => c.tenant_id === tenantId && c.is_active)
    .sort((a, b) => a.position - b.position);
}

function productRows(
  tenantId: string,
  product: Tables<'products'>,
): ProductRows {
  const categoryIds = new Set(
    mockDb.product_categories
      .filter((pc) => pc.tenant_id === tenantId && pc.product_id === product.id)
      .map((pc) => pc.category_id),
  );
  return {
    product,
    variants: mockDb.product_variants.filter(
      (v) => v.tenant_id === tenantId && v.product_id === product.id,
    ),
    images: mockDb.product_images.filter(
      (i) => i.tenant_id === tenantId && i.product_id === product.id,
    ),
    categories: activeCategoryRows(tenantId).filter((c) =>
      categoryIds.has(c.id),
    ),
  };
}

function activeProductRows(tenantId: string): Tables<'products'>[] {
  return mockDb.products.filter(
    (p) => p.tenant_id === tenantId && p.status === 'active',
  );
}

export async function listCategories(
  tenantId: string,
): Promise<CategorySummary[]> {
  'use cache';
  cacheCatalog(tenantId);
  return activeCategoryRows(tenantId).map(toCategory);
}

export async function getCategoryBySlug(
  tenantId: string,
  slug: string,
): Promise<CategorySummary | null> {
  'use cache';
  cacheCatalog(tenantId);
  const row = activeCategoryRows(tenantId).find((c) => c.slug === slug);
  return row ? toCategory(row) : null;
}

export async function listBanners(tenantId: string): Promise<Banner[]> {
  'use cache';
  cacheCatalog(tenantId);
  return mockDb.banners
    .filter((b) => b.tenant_id === tenantId)
    .sort((a, b) => a.position - b.position)
    .map(toBanner);
}

/** Every active product as a card with filter fields, unsorted. */
export async function listCatalogItems(
  tenantId: string,
): Promise<CatalogItem[]> {
  'use cache';
  cacheCatalog(tenantId);
  return activeProductRows(tenantId).map((product) =>
    toCatalogItem(productRows(tenantId, product)),
  );
}

export async function getProductBySlug(
  tenantId: string,
  slug: string,
): Promise<ProductDetail | null> {
  'use cache';
  cacheCatalog(tenantId);
  const product = activeProductRows(tenantId).find((p) => p.slug === slug);
  return product ? toProductDetail(productRows(tenantId, product)) : null;
}
