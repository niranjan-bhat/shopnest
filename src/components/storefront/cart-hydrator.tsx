'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/features/cart/store';

/**
 * Loads the saved cart from localStorage once the page has hydrated, and
 * marks <html data-hydrated> so end-to-end tests can wait until buttons and
 * filters respond (clicks before hydration are lost).
 */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
