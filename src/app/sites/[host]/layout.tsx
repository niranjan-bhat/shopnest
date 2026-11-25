import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CountVisits } from '@/components/storefront/count-visits';
import { StoreShellFallback } from '@/components/storefront/fallbacks';
import { StoreUnavailable } from '@/components/storefront/store-unavailable';
import { StoreRoot } from '@/components/storefront/store-root';
import { loadStorefront } from '@/features/storefront/context';
import { isSuspendedHost, listStoreHosts } from '@/features/tenants/queries';
import { getPublicEnv } from '@/lib/env.public';
import { mediaUrl } from '@/lib/media';
import { storeIcon } from '@/lib/store-icon';
import { atLeastOne } from '@/lib/static-params';
import { appOrigin } from '@/lib/tenant';
import { getTemplate } from '@/templates/registry';

export async function generateStaticParams() {
  const hosts = await listStoreHosts();
  return atLeastOne('host', hosts);
}

export async function generateMetadata({
  params,
}: LayoutProps<'/sites/[host]'>): Promise<Metadata> {
  const { host } = await params;
  const storefront = await loadStorefront(host);
  if (!storefront) {
    return (await isSuspendedHost(host))
      ? { title: 'Store unavailable', robots: { index: false } }
      : {};
  }
  const { store, theme } = storefront;
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description: store.branding.tagline,
    icons: {
      icon: store.branding.faviconKey
        ? mediaUrl(store.branding.faviconKey)
        : storeIcon(store.name, theme.tokens.colors),
    },
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
  if (!storefront) {
    if (await isSuspendedHost(host)) return <StoreUnavailable />;
    notFound();
  }
  return (
    <StoreRoot
      store={storefront.store}
      theme={storefront.theme}
      template={getTemplate(storefront.theme.templateKey)}
    >
      {children}
      <CountVisits
        appOrigin={appOrigin(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN)}
      />
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
