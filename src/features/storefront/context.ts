import { cacheLife } from 'next/cache';
import { listCategories } from '@/features/catalog/queries';
import { listPublishedPages } from '@/features/pages/queries';
import { getStoreByHost } from '@/features/tenants/queries';
import type { ThemeConfig } from '@/features/theme/schema';
import type { StoreContext } from '@/templates/contract';

/**
 * Prefix for store links. Each store is served on its own host name
 * (proxy.ts rewrites it to /sites/<host>), so links are plain "/c/…" paths.
 */
const STORE_BASE_PATH = '';

export type Storefront = { store: StoreContext; theme: ThemeConfig };

/** The store context and theme for a `/sites/[host]` request, or null. */
export async function loadStorefront(host: string): Promise<Storefront | null> {
  'use cache';
  cacheLife('hours');

  const store = await getStoreByHost(host);
  if (!store) return null;
  const [categories, pages] = await Promise.all([
    listCategories(store.id),
    listPublishedPages(store.id),
  ]);

  return {
    theme: store.theme,
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      whatsappNumber: store.whatsappNumber,
      contact: store.contact,
      pages,
      branding: store.theme.branding,
      announcement: store.theme.announcement ?? null,
      basePath: STORE_BASE_PATH,
      categories,
    },
  };
}
