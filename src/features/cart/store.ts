'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { countVisit } from '@/features/visitors/client';
import {
  addLine,
  removeLine,
  setLineQty,
  type CartItemInput,
  type CartLine,
} from './cart';

type CartState = {
  /** Carts keyed by tenant id, so stores never share a cart. */
  carts: Record<string, CartLine[]>;
  add: (tenantId: string, item: CartItemInput, qty?: number) => void;
  setQty: (tenantId: string, variantId: string, qty: number) => void;
  remove: (tenantId: string, variantId: string) => void;
  clear: (tenantId: string) => void;
  /** Replaces a store's lines, e.g. after the server updated prices. */
  replace: (tenantId: string, lines: CartLine[]) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => {
      const update = (
        tenantId: string,
        fn: (lines: CartLine[]) => CartLine[],
      ) =>
        set((state) => ({
          carts: {
            ...state.carts,
            [tenantId]: fn(state.carts[tenantId] ?? []),
          },
        }));
      return {
        carts: {},
        add: (tenantId, item, qty = 1) => {
          update(tenantId, (lines) => addLine(lines, item, qty));
          countVisit({ event: 'bag' });
        },
        setQty: (tenantId, variantId, qty) =>
          update(tenantId, (lines) => setLineQty(lines, variantId, qty)),
        remove: (tenantId, variantId) =>
          update(tenantId, (lines) => removeLine(lines, variantId)),
        clear: (tenantId) => update(tenantId, () => []),
        replace: (tenantId, lines) => update(tenantId, () => lines),
      };
    },
    {
      name: 'shopnest-cart',
      version: 1,
      // `window.` so this throws (and persistence is skipped) during server
      // rendering instead of touching Node's experimental localStorage.
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ carts: state.carts }),
      // Rehydrated by <CartHydrator /> after mount, so the server render and
      // the first client render match (both show an empty cart).
      skipHydration: true,
    },
  ),
);

const EMPTY: CartLine[] = [];

/** The cart lines for one store. */
export function useCartLines(tenantId: string): CartLine[] {
  return useCartStore((state) => state.carts[tenantId] ?? EMPTY);
}

/** True once the saved cart has been read from localStorage. */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

type CartDrawerState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/** Whether the slide-in cart is open (not persisted). */
export const useCartDrawer = create<CartDrawerState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
