import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { StoreShellFallback } from '@/components/storefront/fallbacks';
import { StoreRoot } from '@/components/storefront/store-root';
import { loadStorefront } from '@/features/storefront/context';
import { listStoreHosts } from '@/features/tenants/queries';
import { getTemplate } from '@/templates/registry';

export async function generateStaticParams() {
  const hosts = await listStoreHosts();
  return hosts.map((host) => ({ host }));
}

export async function generateMetadata({
  params,
}: LayoutProps<'/sites/[host]'>): Promise<Metadata> {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) return {};
  const { store } = storefront;
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description: store.branding.tagline,
  };
}

async function Storefront({
  params,
  children,
}: {
  params: LayoutProps<'/sites/[host]'>['params'];
  children: ReactNode;
}) {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) notFound();
  return (
    <StoreRoot
      store={storefront.store}
      theme={storefront.theme}
      template={getTemplate(storefront.theme.templateKey)}
    >
      {children}
    </StoreRoot>
  );
}

export default function StoreLayout({
  params,
  children,
}: LayoutProps<'/sites/[host]'>) {
  return (
    <Suspense fallback={<StoreShellFallback />}>
      <Storefront params={params}>{children}</Storefront>
    </Suspense>
  );
}
