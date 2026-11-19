import { cacheLife, cacheTag } from 'next/cache';
import { parseThemeConfig, type ThemeConfig } from '@/features/theme/schema';
import { mockDb } from '@/mocks';

export type Store = {
  id: string;
  slug: string;
  name: string;
  /** E.164, e.g. +919876543210. */
  whatsappNumber: string;
  currency: string;
  theme: ThemeConfig;
};

export const tenantTag = (tenantId: string) => `tenant:${tenantId}`;

/**
 * Resolves the store for a `/sites/[host]` request. Returns null for unknown
 * hosts and for stores that are not active.
 *
 * Phase 1 has no proxy yet, so the route is reached as /sites/<slug> and the
 * slug is accepted in place of a hostname. Phase 2 removes that fallback when
 * proxy.ts starts rewriting real hostnames.
 */
export async function getStoreByHost(host: string): Promise<Store | null> {
  'use cache';
  cacheLife('hours');

  const hostname = decodeURIComponent(host).toLowerCase();
  const domain = mockDb.tenant_domains.find((d) => d.hostname === hostname);
  const tenant = domain
    ? mockDb.tenants.find((t) => t.id === domain.tenant_id)
    : mockDb.tenants.find((t) => t.slug === hostname);
  if (!tenant || tenant.status !== 'active') return null;

  cacheTag(tenantTag(tenant.id));

  const themeRow = mockDb.tenant_themes.find((t) => t.tenant_id === tenant.id);
  if (!themeRow) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    whatsappNumber: tenant.whatsapp_number,
    currency: tenant.currency,
    theme: parseThemeConfig(themeRow.published),
  };
}

/** Hosts to prerender at build time. */
export async function listStoreHosts(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  return mockDb.tenants.filter((t) => t.status === 'active').map((t) => t.slug);
}
