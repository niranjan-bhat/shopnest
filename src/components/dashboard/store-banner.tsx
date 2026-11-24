import Link from 'next/link';
import { formatDay } from '@/features/billing/dates';
import { getStorePlan } from '@/features/billing/queries';
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
  const subscription = await getStorePlan(store.id);
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
      {subscription?.overdue &&
        subscription.nextDue &&
        store.role !== 'staff' &&
        store.status === 'active' && (
          <div
            role="status"
            className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 md:px-8 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            data-testid="overdue-banner"
          >
            <strong>Payment overdue.</strong> Your {subscription.plan.name} plan
            was due on {formatDay(subscription.nextDue)}. Please contact the
            Zarify team to keep your store open.
          </div>
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
