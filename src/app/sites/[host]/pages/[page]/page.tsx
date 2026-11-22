import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { getPublishedPage } from '@/features/pages/queries';
import { loadStorefront } from '@/features/storefront/context';
import { getStoreByHost } from '@/features/tenants/queries';
import { getTemplate } from '@/templates/registry';

type Props = PageProps<'/sites/[host]/pages/[page]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, page } = await params;
  const store = await getStoreByHost(host);
  const found = store ? await getPublishedPage(store.id, page) : null;
  return found ? { title: found.title } : {};
}

async function ContentRoute({ params }: Pick<Props, 'params'>) {
  const { host, page } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const found = await getPublishedPage(storefront.store.id, page);
  if (!found) notFound();
  const { ContentPage } = getTemplate(storefront.theme.templateKey);
  return <ContentPage store={storefront.store} page={found} />;
}

export default function StoreContentPage(props: Props) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <ContentRoute params={props.params} />
    </Suspense>
  );
}
