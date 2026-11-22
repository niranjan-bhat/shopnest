import { cacheLife } from 'next/cache';
import { listCategories } from '@/features/catalog/queries';
import {
  getStoreByHost,
  listPrimaryStoreHosts,
} from '@/features/tenants/queries';
import type { ThemeConfig } from '@/features/theme/schema';
import { getPublicEnv } from '@/lib/env.public';
import { originFor } from '@/lib/tenant';
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
  const categories = await listCategories(store.id);

  return {
    theme: store.theme,
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      whatsappNumber: store.whatsappNumber,
      contact: store.contact,
      branding: store.theme.branding,
      announcement: store.theme.announcement ?? null,
      basePath: STORE_BASE_PATH,
      categories,
    },
  };
}

export type StoreLink = {
  slug: string;
  name: string;
  tagline: string | null;
  url: string;
};

/** Live stores for the platform index page at "/". */
export async function listStoreLinks(): Promise<StoreLink[]> {
  'use cache';
  cacheLife('hours');
  const rootDomain = getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  const hosts = await listPrimaryStoreHosts();
  const stores = await Promise.all(
    hosts.map(async (hostname) => {
      const store = await getStoreByHost(hostname);
      return store
        ? {
            slug: store.slug,
            name: store.name,
            tagline: store.theme.branding.tagline ?? null,
            url: originFor(hostname, rootDomain),
          }
        : null;
    }),
  );
  return stores.filter((s) => s !== null);
}
