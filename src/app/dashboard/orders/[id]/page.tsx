import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrderDetail } from '@/components/dashboard/orders/order-detail';
import { Skeleton } from '@/components/ui/skeleton';
import { idSchema } from '@/features/catalog/schemas';
import { getDashboardOrder } from '@/features/orders/dashboard';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Order' };

type Props = PageProps<'/dashboard/orders/[id]'>;

async function Order({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  const { store } = await requireStore(`/dashboard/orders/${id}`);
  const orderId = idSchema.safeParse(id);
  if (!orderId.success) notFound();
  const order = await getDashboardOrder(store.id, orderId.data);
  if (!order) notFound();
  return <OrderDetail order={order} storeName={store.name} />;
}

export default function OrderPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Order params={params} />
    </Suspense>
  );
}
