import { getPublicEnv } from '@/lib/env.public';
import { appOrigin, normalizeHostname, originFor } from '@/lib/tenant';
import { waLink } from '@/lib/whatsapp';

// The platform site's own contact details and links. Nothing here comes from
// the database, so no merchant's store or plan can appear on it.

export const SALES_PHONE = '+919632531541';
export const SALES_PHONE_LABEL = '+91 96325 31541';

export const salesLink = waLink(
  SALES_PHONE,
  'Hi, I want an online store for my shop.',
);

function root() {
  const rootDomain = getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  const host = normalizeHostname(rootDomain);
  if (!host) throw new Error(`Invalid root domain: ${rootDomain}`);
  return { rootDomain, host };
}

export function siteOrigin(): string {
  const { rootDomain, host } = root();
  return originFor(host, rootDomain);
}

export function loginUrl(): string {
  return `${appOrigin(root().rootDomain)}/login`;
}

/** A demo store's address, e.g. https://saree-demo.zarify.in. */
export function demoUrl(slug: string): string {
  const { rootDomain, host } = root();
  return originFor(`${slug}.${host}`, rootDomain);
}

export const DEMOS = [
  { slug: 'saree-demo', name: 'Tara Weaves', kind: 'A silk saree shop' },
  {
    slug: 'boutique-demo',
    name: 'Noor Atelier',
    kind: 'An ethnic wear boutique',
  },
] as const;
