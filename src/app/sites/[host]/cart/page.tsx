import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { loadStorefront } from '@/features/storefront/context';
import { getTemplate } from '@/templates/registry';

export const metadata: Metadata = {
  title: 'Your bag',
  robots: { index: false },
};

async function Cart({
  params,
}: Pick<PageProps<'/sites/[host]/cart'>, 'params'>) {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const { CartPage } = getTemplate(storefront.theme.templateKey);
  return <CartPage store={storefront.store} />;
}

export default function CartRoute(props: PageProps<'/sites/[host]/cart'>) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Cart params={props.params} />
    </Suspense>
  );
}
