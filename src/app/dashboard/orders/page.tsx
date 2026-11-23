import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderList } from '@/components/dashboard/orders/order-list';
import { Skeleton } from '@/components/ui/skeleton';
import {
  countDashboardOrders,
  listDashboardOrders,
  parseOrderListFilter,
} from '@/features/orders/dashboard';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Orders' };

type Props = PageProps<'/dashboard/orders'>;

async function Orders({ searchParams }: Pick<Props, 'searchParams'>) {
  const { store } = await requireStore('/dashboard/orders');
  const filter = parseOrderListFilter(await searchParams);
  const [page, counts] = await Promise.all([
    listDashboardOrders(store.id, filter),
    countDashboardOrders(store.id),
  ]);
  return <OrderList page={page} counts={counts} filter={filter} />;
}

function OrdersSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="grid gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}
