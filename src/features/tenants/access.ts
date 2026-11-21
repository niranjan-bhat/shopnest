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
    return {
      user,
      superAdmin,
      stores,
      store: pickActiveStore(stores, savedId),
    };
  },
);

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
 * For Server Actions that change a store's data: the user and the active
 * store, with access re-checked in the database right before the write.
 * Throws instead of redirecting, because a failed action is an error, not a
 * navigation. Writes must still filter by `store.id` explicitly.
 */
export async function requireStoreForAction(): Promise<StoreContext> {
  const context = await loadDashboardContext();
  if (!context) throw new Error('Not signed in');
  if (!context.store) throw new Error('No store selected');
  const supabase = await createServerSupabase();
  const allowed = check(
    await supabase.rpc('can_manage_tenant', { tid: context.store.id }),
    'can_manage_tenant',
  );
  if (allowed !== true) throw new Error('No access to this store');
  return { ...context, store: context.store };
}
