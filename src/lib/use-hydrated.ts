'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true once this component is
 * interactive. Forms expose it as `data-hydrated` so end-to-end tests wait
 * before typing: input typed earlier is lost or merged into the
 * server-rendered value.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
