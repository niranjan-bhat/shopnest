'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** The store fields client components need (no catalog data). */
export type ClientStore = {
  id: string;
  name: string;
  whatsappNumber: string;
  basePath: string;
};

const StoreContext = createContext<ClientStore | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: ClientStore;
  children: ReactNode;
}) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): ClientStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
