import 'server-only';
import { getPublicEnv } from '@/lib/env.public';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { originFor } from '@/lib/tenant';
import type { Enums } from '@/types/database';

// Reads for the dashboard and admin area. They run as the signed-in user, so
// RLS decides what comes back: members see their own stores, super admins
// see every store.

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  status: Enums<'tenant_status'>;
  /** Storefront URL on the primary host name, if the store has one. */
  url: string | null;
};

export type MyStore = StoreSummary & { role: Enums<'member_role'> };

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: Enums<'tenant_status'>;
  tenant_domains: { hostname: string; is_primary: boolean }[];
};

function toSummary(tenant: TenantRow): StoreSummary {
  const primary =
    tenant.tenant_domains.find((d) => d.is_primary) ?? tenant.tenant_domains[0];
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    url: primary
      ? originFor(primary.hostname, getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN)
      : null,
  };
}

const TENANT_FIELDS =
  'id, name, slug, status, tenant_domains(hostname, is_primary)' as const;

/** Stores the user belongs to, with their role in each. */
export async function listMyStores(userId: string): Promise<MyStore[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('tenant_members')
      .select(`role, tenants(${TENANT_FIELDS})`)
      .eq('user_id', userId)
      .order('created_at'),
    'tenant_members',
  );
  return rows
    .filter((row) => row.tenants !== null)
    .map((row) => ({ ...toSummary(row.tenants), role: row.role }));
}

export type StoreStats = {
  /** Draft and active products (archived ones are left out). */
  products: number;
  activeProducts: number;
  categories: number;
};

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

/** Catalog counts for the overview page. */
export async function getStoreStats(tenantId: string): Promise<StoreStats> {
  const supabase = await createServerSupabase();
  const head = { count: 'exact', head: true } as const;
  const [products, activeProducts, categories] = await Promise.all([
    supabase
      .from('products')
      .select('id', head)
      .eq('tenant_id', tenantId)
      .neq('status', 'archived'),
    supabase
      .from('products')
      .select('id', head)
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase.from('categories').select('id', head).eq('tenant_id', tenantId),
  ]);
  return {
    products: countOf(products, 'products'),
    activeProducts: countOf(activeProducts, 'products'),
    categories: countOf(categories, 'categories'),
  };
}

/** Every store on the platform (super admins only; RLS enforces it). */
export async function listAllStores(): Promise<StoreSummary[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase.from('tenants').select(TENANT_FIELDS).order('created_at'),
    'tenants',
  );
  return rows.map(toSummary);
}
