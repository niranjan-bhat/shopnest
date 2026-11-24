import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import {
  getSessionUser,
  isSuperAdmin,
  type SessionUser,
} from '@/features/auth/session';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  ACTIVE_STORE_COOKIE,
  mergeStoreChoices,
  pickActiveStore,
  type StoreChoice,
} from './active-store';
import { listAllStores, listMyStores } from './dashboard';

export type DashboardContext = {
  user: SessionUser;
  superAdmin: boolean;
  /** Every store the user may open. */
  stores: StoreChoice[];
  /** The store the dashboard is working on; null when the user has none. */
  store: StoreChoice | null;
  /**
   * When a super admin's edit session on the store ends. Null without one
   * (and for members, who do not need it).
   */
  editingUntil: string | null;
};

export type StoreContext = DashboardContext & { store: StoreChoice };

/**
 * The signed-in user, their stores and the active store. Loaded once per
 * request (the header and the page both ask for it). The store list comes
 * through RLS, so it only ever holds stores the user may open.
 */
const loadDashboardContext = cache(
  async (): Promise<DashboardContext | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const superAdmin = await isSuperAdmin();
    const [mine, all] = await Promise.all([
      listMyStores(user.id),
      superAdmin ? listAllStores() : null,
    ]);
    const stores = mergeStoreChoices(mine, all);
    const savedId = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
    const store = pickActiveStore(stores, savedId);
    return {
      user,
      superAdmin,
      stores,
      store,
      editingUntil:
        store?.role === 'admin' ? await getEditingUntil(store.id) : null,
    };
  },
);

/** When the signed-in super admin's edit session on a store ends, if any. */
async function getEditingUntil(tenantId: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('admin_edit_sessions')
      .select('expires_at')
      .eq('tenant_id', tenantId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
    'admin_edit_sessions',
  );
  return row?.expires_at ?? null;
}

/** For UI that shows nothing to signed-out visitors (e.g. the header). */
export function getDashboardContext(): Promise<DashboardContext | null> {
  return loadDashboardContext();
}

/** For dashboard pages: signed-out visitors go to /login and back. */
export async function requireDashboard(
  returnTo: string,
): Promise<DashboardContext> {
  const context = await loadDashboardContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return context;
}

/**
 * For pages that work on a store. Users without one go to the overview,
 * which explains how to get access.
 */
export async function requireStore(returnTo: string): Promise<StoreContext> {
  const context = await requireDashboard(returnTo);
  if (!context.store) redirect('/dashboard');
  return { ...context, store: context.store };
}

/**
 * For pages staff may not open (storefront, settings): they go to the
 * overview. Super admins may look.
 */
export async function requireOwner(returnTo: string): Promise<StoreContext> {
  const context = await requireStore(returnTo);
  if (context.store.role === 'staff') redirect('/dashboard');
  return context;
}

/**
 * For Server Actions that change a store's data: the user and the active
 * store, with access re-checked in the database right before the write (a
 * super admin who is not a member needs an edit session).
 * Throws instead of redirecting, because a failed action is an error, not a
 * navigation. Writes must still filter by `store.id` explicitly.
 */
export function requireStoreForAction(): Promise<StoreContext> {
  return requireForAction('can_manage_tenant');
}

/**
 * The same for changes staff may not make: the storefront, pages and store
 * settings. The database refuses staff there too.
 */
export function requireOwnerForAction(): Promise<StoreContext> {
  return requireForAction('can_own_tenant');
}

async function requireForAction(
  rule: 'can_manage_tenant' | 'can_own_tenant',
): Promise<StoreContext> {
  const context = await loadDashboardContext();
  if (!context) throw new Error('Not signed in');
  if (!context.store) throw new Error('No store selected');
  const supabase = await createServerSupabase();
  const allowed = check(
    await supabase.rpc(rule, { tid: context.store.id }),
    rule,
  );
  if (allowed !== true) throw new Error('No access to this store');
  return { ...context, store: context.store };
}
