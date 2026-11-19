import { cacheLife } from 'next/cache';
import { listCategories } from '@/features/catalog/queries';
import { getStoreByHost } from '@/features/tenants/queries';
import type { ThemeConfig } from '@/features/theme/schema';
import { mockDb } from '@/mocks';
import type { StoreContext } from '@/templates/contract';

/**
 * Where store links point. Phase 1 serves stores under /sites/<slug>; in
 * Phase 2 proxy.ts rewrites each store's own hostname to that route, and
 * this returns "" so links are plain "/c/…" paths.
 */
export function storeBasePath(host: string): string {
  return `/sites/${encodeURIComponent(host)}`;
}

export type Storefront = { store: StoreContext; theme: ThemeConfig };

/** The store context and theme for a `/sites/[host]` request, or null. */
export async function loadStorefront(host: string): Promise<Storefront | null> {
  'use cache';
  cacheLife('hours');

  const store = await getStoreByHost(host);
  if (!store) return null;
  const categories = await listCategories(store.id);

  return {
    theme: store.theme,
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      whatsappNumber: store.whatsappNumber,
      branding: store.theme.branding,
      announcement: store.theme.announcement ?? null,
      basePath: storeBasePath(host),
      categories,
    },
  };
}

/** Demo store list for the Phase 1 index page at "/". */
export async function listDemoStores(): Promise<
  { slug: string; name: string; tagline: string | null }[]
> {
  'use cache';
  cacheLife('hours');
  const stores = await Promise.all(
    mockDb.tenants
      .filter((t) => t.status === 'active')
      .map((t) => getStoreByHost(t.slug)),
  );
  return stores
    .filter((s) => s !== null)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      tagline: s.theme.branding.tagline ?? null,
    }));
}
