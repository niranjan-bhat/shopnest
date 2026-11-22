import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorePageFallback } from '@/components/storefront/fallbacks';
import { loadStorefront } from '@/features/storefront/context';
import { getTemplate } from '@/templates/registry';

export const metadata: Metadata = { title: 'Contact us' };

async function Contact({
  params,
}: Pick<PageProps<'/sites/[host]/contact'>, 'params'>) {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  const { ContactPage } = getTemplate(storefront.theme.templateKey);
  return <ContactPage store={storefront.store} />;
}

export default function ContactRoute(
  props: PageProps<'/sites/[host]/contact'>,
) {
  return (
    <Suspense fallback={<StorePageFallback />}>
      <Contact params={props.params} />
    </Suspense>
  );
}
