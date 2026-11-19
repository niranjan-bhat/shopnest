'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { storeHref, storePaths } from './links';
import { useStore } from './store-provider';

/** Link to the current store's home page, for client-only contexts. */
export function StoreHomeLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { basePath } = useStore();
  return (
    <Link href={storeHref(basePath, storePaths.home)} className={className}>
      {children}
    </Link>
  );
}
