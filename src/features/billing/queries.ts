import 'server-only';
import { z } from 'zod';
import type { Paise } from '@/lib/money';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { isOverdue, todayInIndia } from './dates';
import { parseLimits, type PaymentMethod, type PlanLimits } from './schema';

// Billing reads, as the signed-in user. Members see their own store's plan;
// payments and every other store's plan are for super admins (RLS).

export type Plan = {
  id: string;
  name: string;
  setupFeePaise: Paise;
  monthlyFeePaise: Paise;
  limits: PlanLimits;
  isActive: boolean;
};

const PLAN_FIELDS =
  'id, name, setup_fee_paise, monthly_fee_paise, limits, is_active' as const;

function toPlan(row: {
  id: string;
  name: string;
  setup_fee_paise: number;
  monthly_fee_paise: number;
  limits: Json;
  is_active: boolean;
}): Plan {
  return {
    id: row.id,
    name: row.name,
    setupFeePaise: row.setup_fee_paise,
    monthlyFeePaise: row.monthly_fee_paise,
    limits: parseLimits(row.limits),
    isActive: row.is_active,
  };
}

/** Every plan with how many stores are on it, cheapest first. */
export async function listPlans(): Promise<(Plan & { stores: number })[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('plans')
      .select(`${PLAN_FIELDS}, subscriptions(count)`)
      .order('is_active', { ascending: false })
      .order('monthly_fee_paise')
      .order('name'),
    'plans',
  );
  return rows.map((row) => ({
    ...toPlan(row),
    stores: row.subscriptions[0]?.count ?? 0,
  }));
}

export async function getPlan(id: string): Promise<Plan | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createServerSupabase();
  const row = check(
    await supabase.from('plans').select(PLAN_FIELDS).eq('id', id).maybeSingle(),
    'plans',
  );
  return row ? toPlan(row) : null;
}

export type StorePlan = {
  plan: Plan;
  billingStart: string | null;
  /** "YYYY-MM-DD"; null when the store is not billed. */
  nextDue: string | null;
  overdue: boolean;
};

/** A store's plan and when it next pays; null without a subscription. */
export async function getStorePlan(
  tenantId: string,
): Promise<StorePlan | null> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('subscriptions')
      .select(`billing_start, next_due, plans(${PLAN_FIELDS})`)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    'subscriptions',
  );
  if (!row) return null;
  return {
    plan: toPlan(row.plans),
    billingStart: row.billing_start,
    nextDue: row.next_due,
    overdue: isOverdue(row.next_due, todayInIndia()),
  };
}

export type Usage = { products: number; team: number };

/** What counts towards the store's limits. */
export async function getUsage(tenantId: string): Promise<Usage> {
  const supabase = await createServerSupabase();
  const head = { count: 'exact', head: true } as const;
  const [products, team] = await Promise.all([
    supabase
      .from('products')
      .select('id', head)
      .eq('tenant_id', tenantId)
      .neq('status', 'archived'),
    supabase
      .from('tenant_members')
      .select('user_id', head)
      .eq('tenant_id', tenantId),
  ]);
  if (products.error) throw new Error(products.error.message);
  if (team.error) throw new Error(team.error.message);
  return { products: products.count ?? 0, team: team.count ?? 0 };
}

export type Payment = {
  id: string;
  amountPaise: Paise;
  paidOn: string;
  method: PaymentMethod;
  months: number;
  reference: string | null;
  voidReason: string | null;
};

/** A store's payments, newest first (super admins only). */
export async function listPayments(tenantId: string): Promise<Payment[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('subscription_payments')
      .select(
        'id, amount_paise, paid_on, method, months, reference, void_reason',
      )
      .eq('tenant_id', tenantId)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false }),
    'subscription_payments',
  );
  return rows.map((row) => ({
    id: row.id,
    amountPaise: row.amount_paise,
    paidOn: row.paid_on,
    method: row.method,
    months: row.months,
    reference: row.reference,
    voidReason: row.void_reason,
  }));
}

/** Ids of every store whose payment is overdue. */
export async function listOverdueStoreIds(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('subscriptions')
      .select('tenant_id')
      .lt('next_due', todayInIndia()),
    'subscriptions',
  );
  return rows.map((row) => row.tenant_id);
}
