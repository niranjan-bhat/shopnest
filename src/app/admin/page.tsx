import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requireSuperAdmin } from '@/features/auth/session';
import { listAllStores } from '@/features/tenants/dashboard';

export const metadata: Metadata = {
  title: 'Super admin · ShopNest',
  robots: { index: false },
};

/** Phase 2 placeholder: proves the super-admin guard. Onboarding and plans
 * arrive in Phase 5. */
async function Stores() {
  await requireSuperAdmin('/admin');
  const stores = await listAllStores();
  return (
    <ul className="mt-6 divide-y rounded-xl border" data-testid="all-stores">
      {stores.map((store) => (
        <li
          key={store.id}
          className="flex items-center justify-between gap-4 p-4"
        >
          <div>
            <p className="font-medium">{store.name}</p>
            <p className="text-sm text-muted-foreground">{store.slug}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="capitalize">{store.status}</span>
            {store.url && (
              <a href={store.url} className="underline underline-offset-4">
                View
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link href="/dashboard" className="text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Super admin
      </h1>
      <p className="mt-2 text-muted-foreground">Every store on the platform.</p>
      <Suspense
        fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}
      >
        <Stores />
      </Suspense>
    </main>
  );
}
