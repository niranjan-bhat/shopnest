import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { loadStorefront } from '@/features/storefront/context';
import { resolveHomeSections } from '@/features/storefront/home';
import { getTemplate } from '@/templates/registry';

async function Home({ params }: Pick<PageProps<'/sites/[host]'>, 'params'>) {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const { store, theme } = storefront;
  const template = getTemplate(theme.templateKey);
  const sections = await resolveHomeSections(
    store.id,
    theme.sections,
    template.sections,
  );
  return <template.HomePage store={store} sections={sections} />;
}

export default function HomePage(props: PageProps<'/sites/[host]'>) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Home params={props.params} />
    </Suspense>
  );
}
