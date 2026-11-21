import type { Metadata } from 'next';
import { atLeastOne } from '@/lib/static-params';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { getCategoryBySlug } from '@/features/catalog/queries';
import { loadStorefront } from '@/features/storefront/context';
import { listStorePaths, loadCategoryPage } from '@/features/storefront/pages';
import { getStoreByHost } from '@/features/tenants/queries';
import { getTemplate } from '@/templates/registry';

type Props = PageProps<'/sites/[host]/c/[category]'>;

export async function generateStaticParams({
  params,
}: {
  params: { host: string };
}) {
  const store = await getStoreByHost(params.host);
  if (!store) return atLeastOne('category', []);
  const { categories } = await listStorePaths(store.id);
  return atLeastOne('category', categories);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, category } = await params;
  const store = await getStoreByHost(host);
  const found = store ? await getCategoryBySlug(store.id, category) : null;
  return found ? { title: found.name } : {};
}

async function Category({ params, searchParams }: Props) {
  const [{ host, category }, query] = await Promise.all([params, searchParams]);
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const data = await loadCategoryPage(storefront.store.id, category, query);
  if (!data) notFound();
  const { CategoryPage } = getTemplate(storefront.theme.templateKey);
  return <CategoryPage store={storefront.store} {...data} />;
}

export default function CategoryRoute(props: Props) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Category {...props} />
    </Suspense>
  );
}
