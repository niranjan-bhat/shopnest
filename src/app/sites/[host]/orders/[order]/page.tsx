import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { getShopperOrder } from '@/features/orders/queries';
import { loadStorefront } from '@/features/storefront/context';
import { getTemplate } from '@/templates/registry';

type Props = PageProps<'/sites/[host]/orders/[order]'>;

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false },
};

async function OrderRoute({ params }: Pick<Props, 'params'>) {
  const { host, order: orderId } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const order = await getShopperOrder(storefront.store.id, orderId);
  if (!order) notFound();
  const { OrderPage } = getTemplate(storefront.theme.templateKey);
  return <OrderPage store={storefront.store} order={order} />;
}

export default function StoreOrderPage(props: Props) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <OrderRoute params={props.params} />
    </Suspense>
  );
}
