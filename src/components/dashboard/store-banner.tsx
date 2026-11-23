import Link from 'next/link';
import { getDashboardContext } from '@/features/tenants/access';
import { AdminViewBar } from './admin-view-bar';

/**
 * Notices above every dashboard page: a super admin viewing a store they are
 * not a member of, and a suspended store.
 */
export async function StoreBanner() {
  const context = await getDashboardContext();
  const store = context?.store;
  if (!store) return null;
  return (
    <>
      {store.role === 'admin' && (
        <AdminViewBar
          key={store.id}
          storeName={store.name}
          editingUntil={context.editingUntil}
        >
          <Link
            href={`/admin/tenants/${store.id}`}
            className="underline underline-offset-4"
          >
            Back to admin
          </Link>
        </AdminViewBar>
      )}
      {store.status === 'suspended' && (
        <div
          role="status"
          className="border-b border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm md:px-8"
          data-testid="suspended-banner"
        >
          <strong>{store.name} is suspended.</strong> Shoppers cannot open it or
          place orders. You can still work on it here.
          {store.suspendedReason && <> Reason: {store.suspendedReason}</>}
        </div>
      )}
    </>
  );
}
