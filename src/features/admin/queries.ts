import 'server-only';
import { z } from 'zod';
import { getPublicEnv } from '@/lib/env.public';
import type { Paise } from '@/lib/money';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { originFor } from '@/lib/tenant';
import { templates as codeTemplates } from '@/templates/registry';
import type { Enums } from '@/types/database';
import { missingSchema, type Missing } from './status';
import {
  storeSearch,
  type StoreListFilter,
  type TenantStatus,
} from './store-list';

// Reads for the super admin area. They run as the signed-in user, so RLS
// shows every store to super admins only; pages still check access first.

export const STORE_PAGE_SIZE = 25;

export type AdminStoreRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  url: string | null;
  planName: string | null;
  createdAt: string;
};

const FIELDS =
  'id, name, slug, status, whatsapp_number, business_type, suspended_reason, created_at, tenant_domains(hostname, is_primary), subscriptions(plans(name))' as const;

type Row = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  created_at: string;
  tenant_domains: { hostname: string; is_primary: boolean }[];
  subscriptions: { plans: { name: string } } | null;
};

function toRow(row: Row): AdminStoreRow {
  const domain =
    row.tenant_domains.find((d) => d.is_primary) ?? row.tenant_domains[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    url: domain
      ? originFor(domain.hostname, getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN)
      : null,
    planName: row.subscriptions?.plans.name ?? null,
    createdAt: row.created_at,
  };
}

/** PostgREST's answer to a page past the end ("range not satisfiable"). */
const PAST_LAST_PAGE = 'PGRST103';

/** One page of every store on the platform, newest first. */
export async function listAdminStores(
  filter: StoreListFilter,
): Promise<{ stores: AdminStoreRow[]; total: number }> {
  const supabase = await createServerSupabase();
  const from = (filter.page - 1) * STORE_PAGE_SIZE;
  let query = supabase
    .from('tenants')
    .select(FIELDS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + STORE_PAGE_SIZE - 1);
  if (filter.status !== 'all') query = query.eq('status', filter.status);
  if (filter.search) query = query.or(storeSearch(filter.search));
  const result = await query;
  if (result.error?.code === PAST_LAST_PAGE) {
    return { stores: [], total: result.count ?? 0 };
  }
  const rows = check(result, 'tenants');
  return { stores: rows.map(toRow), total: result.count ?? rows.length };
}

export type AdminStore = AdminStoreRow & {
  whatsappNumber: string;
  businessType: string;
  suspendedReason: string | null;
  /** What it still needs to go live. */
  missing: Missing[];
  team: {
    userId: string;
    email: string;
    role: Enums<'member_role'>;
    signedIn: boolean;
  }[];
};

/** One store with its team; null when there is no such store. */
export async function getAdminStore(id: string): Promise<AdminStore | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createServerSupabase();
  const row = check(
    await supabase.from('tenants').select(FIELDS).eq('id', id).maybeSingle(),
    'tenants',
  );
  if (!row) return null;
  const [teamResult, missingResult] = await Promise.all([
    supabase.rpc('store_team', { tid: id }),
    supabase.rpc('store_missing', { tid: id }),
  ]);
  const team = check(teamResult, 'store_team');
  return {
    ...toRow(row),
    whatsappNumber: row.whatsapp_number,
    businessType: row.business_type,
    suspendedReason: row.suspended_reason,
    missing: missingSchema.parse(check(missingResult, 'store_missing')),
    team: team.map((member) => ({
      userId: member.user_id,
      email: member.email,
      role: member.role,
      signedIn: member.signed_in,
    })),
  };
}

export type PlanOption = { id: string; name: string; monthlyFeePaise: Paise };
export type TemplateOption = { key: string; name: string };
export type StoreOptions = {
  plans: PlanOption[];
  templates: TemplateOption[];
};

/** What a new store can be given: active plans and templates. */
export async function listStoreOptions(): Promise<StoreOptions> {
  const supabase = await createServerSupabase();
  const [plans, templates] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, monthly_fee_paise')
      .eq('is_active', true)
      .order('monthly_fee_paise'),
    supabase
      .from('templates')
      .select('key, name')
      .eq('is_active', true)
      .order('name'),
  ]);
  return {
    plans: check(plans, 'plans').map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyFeePaise: plan.monthly_fee_paise,
    })),
    // Only templates that also ship in this build.
    templates: check(templates, 'templates').filter(
      (template) => template.key in codeTemplates,
    ),
  };
}
