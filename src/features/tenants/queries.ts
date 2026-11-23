import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { parseThemeConfig, type ThemeConfig } from '@/features/theme/schema';
import { CONTACT_COLUMNS, toStoreContact, type StoreContact } from './settings';
import { check } from '@/lib/supabase/result';
import { storefrontDb } from '@/lib/supabase/storefront';
import { normalizeHostname } from '@/lib/tenant';

export type Store = {
  id: string;
  slug: string;
  name: string;
  /** E.164, e.g. +919876543210. */
  whatsappNumber: string;
  currency: string;
  contact: StoreContact;
  theme: ThemeConfig;
};

export const tenantTag = (tenantId: string) => `tenant:${tenantId}`;
/** The platform's list of live stores. */
export const STORES_TAG = 'stores';
export const hostTag = (hostname: string) => `host:${hostname}`;

/**
 * Resolves the store for a storefront hostname (proxy.ts rewrites each
 * store's host to /sites/<hostname>). Null for unknown hosts, stores that are
 * not active, and stores that have never published a theme; RLS hides the
 * first two from the anonymous client anyway.
 */
export async function getStoreByHost(host: string): Promise<Store | null> {
  'use cache';
  cacheLife('hours');

  const hostname = normalizeHostname(decodeURIComponent(host));
  if (!hostname) return null;
  cacheTag(hostTag(hostname));

  const db = storefrontDb();
  const domain = check(
    await db
      .from('tenant_domains')
      .select('tenant_id')
      .eq('hostname', hostname)
      .maybeSingle(),
    'tenant_domains',
  );
  if (!domain) return null;
  cacheTag(tenantTag(domain.tenant_id));

  const [tenantResult, themeResult] = await Promise.all([
    db
      .from('tenants')
      .select(
        `id, slug, name, status, whatsapp_number, currency, ${CONTACT_COLUMNS}`,
      )
      .eq('id', domain.tenant_id)
      .maybeSingle(),
    // anon may read only these columns (never the draft).
    db
      .from('tenant_themes')
      .select('tenant_id, published')
      .eq('tenant_id', domain.tenant_id)
      .maybeSingle(),
  ]);
  const tenant = check(tenantResult, 'tenants');
  const theme = check(themeResult, 'tenant_themes');
  if (!tenant || tenant.status !== 'active' || !theme?.published) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    whatsappNumber: tenant.whatsapp_number,
    currency: tenant.currency,
    contact: toStoreContact(tenant),
    theme: parseThemeConfig(theme.published),
  };
}

/** Whether a host name belongs to a suspended store (not just no store). */
export async function isSuspendedHost(host: string): Promise<boolean> {
  'use cache';
  cacheLife('hours');
  const hostname = normalizeHostname(decodeURIComponent(host));
  if (!hostname) return false;
  cacheTag(hostTag(hostname));
  return (
    check(
      await storefrontDb().rpc('is_suspended_host', { host: hostname }),
      'is_suspended_host',
    ) === true
  );
}

/** Host names of every live store; prerendered at build time. */
export async function listStoreHosts(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORES_TAG);
  const rows = check(
    await storefrontDb()
      .from('tenant_domains')
      .select('hostname')
      .order('hostname'),
    'tenant_domains',
  );
  return rows.map((row) => row.hostname);
}

/** Primary host name of every live store, for the platform's store list. */
export async function listPrimaryStoreHosts(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(STORES_TAG);
  const rows = check(
    await storefrontDb()
      .from('tenant_domains')
      .select('hostname')
      .eq('is_primary', true)
      .order('hostname'),
    'tenant_domains',
  );
  return rows.map((row) => row.hostname);
}
