import type { MyStore, StoreSummary } from './dashboard';

/** Cookie holding the id of the store the dashboard is working on. */
export const ACTIVE_STORE_COOKIE = 'zarify-store';

/**
 * How the user reaches a store: as a member (owner or staff), or as a super
 * admin who is not a member of it.
 */
export type StoreRole = MyStore['role'] | 'admin';

export type StoreChoice = StoreSummary & { role: StoreRole };

/**
 * Every store the user may open in the dashboard: their own stores first (in
 * membership order), then, for super admins, every other store by name.
 */
export function mergeStoreChoices(
  memberStores: MyStore[],
  allStores: StoreSummary[] | null,
): StoreChoice[] {
  const own: StoreChoice[] = memberStores;
  if (!allStores) return own;
  const ownIds = new Set(own.map((store) => store.id));
  const others = allStores
    .filter((store) => !ownIds.has(store.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((store): StoreChoice => ({ ...store, role: 'admin' }));
  return [...own, ...others];
}

/**
 * The store to show: the one saved in the cookie if the user may still open
 * it, otherwise their first store. Null when they have none.
 */
export function pickActiveStore(
  choices: StoreChoice[],
  savedId: string | undefined,
): StoreChoice | null {
  return choices.find((store) => store.id === savedId) ?? choices[0] ?? null;
}
