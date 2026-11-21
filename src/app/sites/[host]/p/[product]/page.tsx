import type { Metadata } from 'next';
import { atLeastOne } from '@/lib/static-params';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { getProductBySlug } from '@/features/catalog/queries';
import { loadStorefront } from '@/features/storefront/context';
import { listStorePaths, loadProductPage } from '@/features/storefront/pages';
import { getStoreByHost } from '@/features/tenants/queries';
import { getTemplate } from '@/templates/registry';

type Props = PageProps<'/sites/[host]/p/[product]'>;

export async function generateStaticParams({
  params,
}: {
  params: { host: string };
}) {
  const store = await getStoreByHost(params.host);
  if (!store) return atLeastOne('product', []);
  const { products } = await listStorePaths(store.id);
  return atLeastOne('product', products);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, product } = await params;
  const store = await getStoreByHost(host);
  const found = store ? await getProductBySlug(store.id, product) : null;
  if (!found) return {};
  // Open Graph images need an absolute store URL; they arrive with the
  // Phase 6 SEO work once stores have real hostnames.
  return {
    title: found.seo.title ?? found.name,
    description: found.seo.description ?? found.description ?? undefined,
  };
}

async function Product({ params }: Pick<Props, 'params'>) {
  const { host, product } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const data = await loadProductPage(storefront.store.id, product);
  if (!data) notFound();
  const { ProductPage } = getTemplate(storefront.theme.templateKey);
  return <ProductPage store={storefront.store} {...data} />;
}

export default function ProductRoute(props: Props) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Product params={props.params} />
    </Suspense>
  );
}
