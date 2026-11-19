import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { loadStorefront } from '@/features/storefront/context';
import { getTemplate } from '@/templates/registry';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
};

async function Checkout({
  params,
}: Pick<PageProps<'/sites/[host]/checkout'>, 'params'>) {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const { CheckoutPage } = getTemplate(storefront.theme.templateKey);
  return <CheckoutPage store={storefront.store} />;
}

export default function CheckoutRoute(
  props: PageProps<'/sites/[host]/checkout'>,
) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Checkout params={props.params} />
    </Suspense>
  );
}
