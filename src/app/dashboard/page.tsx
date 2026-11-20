import Link from 'next/link';
import { Suspense } from 'react';
import { isSuperAdmin, requireUser } from '@/features/auth/session';
import { listMyStores } from '@/features/tenants/dashboard';

/** Phase 2 placeholder: proves sign-in and store membership. The real
 * dashboard arrives in Phase 3. */
async function Overview() {
  const user = await requireUser('/dashboard');
  const [stores, superAdmin] = await Promise.all([
    listMyStores(user.id),
    isSuperAdmin(),
  ]);

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as <span data-testid="user-email">{user.email}</span>
      </p>

      {superAdmin && (
        <p className="mt-6">
          <Link href="/admin" className="underline underline-offset-4">
            Open super admin
          </Link>
        </p>
      )}

      <h2 className="mt-10 text-lg font-medium">Your stores</h2>
      {stores.length === 0 ? (
        <p className="mt-2 text-muted-foreground" data-testid="no-stores">
          You don&apos;t have access to a store yet. Ask the ShopNest team to
          add you.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {stores.map((store) => (
            <li key={store.id} className="rounded-xl border p-5">
              <p className="font-medium">{store.name}</p>
              <p className="mt-1 text-sm text-muted-foreground capitalize">
                {store.role} · {store.status}
              </p>
              {store.url && (
                <a
                  href={store.url}
                  className="mt-3 inline-block text-sm underline underline-offset-4"
                >
                  View store
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <Overview />
    </Suspense>
  );
}
