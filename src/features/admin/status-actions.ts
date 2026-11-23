'use server';

import { refresh, updateTag } from 'next/cache';
import { requireSuperAdminForAction } from '@/features/auth/session';
import { catalogTag } from '@/features/catalog/queries';
import { getDashboardContext } from '@/features/tenants/access';
import { hostTag, STORES_TAG, tenantTag } from '@/features/tenants/queries';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/action-result';
import { CHECKLIST, statusResultSchema, storeStatusSchema } from './status';

/** Makes a store live, suspends it or reactivates it. */
export async function setStoreStatus(input: unknown): Promise<ActionResult> {
  await requireSuperAdminForAction();
  const parsed = storeStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const change = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('set_store_status', {
    tid: change.storeId,
    next: change.status,
    reason: change.status === 'suspended' ? change.reason : undefined,
  });
  // Someone else changed it first: show where it is now.
  if (error?.code === '22023') {
    refresh();
    return { ok: false, error: 'The store changed meanwhile. Check it again.' };
  }
  if (error) throw new Error(`Changing the status failed: ${error.message}`);
  const result = statusResultSchema.parse(data);
  if (result.status === 'not_ready') {
    refresh();
    const missing = result.missing.map((item) => CHECKLIST[item]).join(', ');
    return { ok: false, error: `Not ready yet. Still needed: ${missing}.` };
  }

  // Everything shoppers have cached about the store: its pages, and "no
  // store here" answers, which know only the host name.
  const domains = check(
    await supabase
      .from('tenant_domains')
      .select('hostname')
      .eq('tenant_id', change.storeId),
    'tenant_domains',
  );
  for (const { hostname } of domains) updateTag(hostTag(hostname));
  updateTag(tenantTag(change.storeId));
  updateTag(catalogTag(change.storeId));
  updateTag(STORES_TAG);
  refresh();
  return { ok: true };
}

/** The store a super admin is viewing in the dashboard. */
async function viewedStoreId(): Promise<string> {
  await requireSuperAdminForAction();
  const store = (await getDashboardContext())?.store;
  if (store?.role !== 'admin') throw new Error('Not viewing a store as admin');
  return store.id;
}

/** Lets the super admin change the store they are viewing for 30 minutes. */
export async function allowEditing(): Promise<void> {
  const tid = await viewedStoreId();
  const supabase = await createServerSupabase();
  check(await supabase.rpc('allow_editing', { tid }), 'allow_editing');
  refresh();
}

export async function stopEditing(): Promise<void> {
  const tid = await viewedStoreId();
  const supabase = await createServerSupabase();
  check(await supabase.rpc('stop_editing', { tid }), 'stop_editing');
  refresh();
}
