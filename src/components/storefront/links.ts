/**
 * Builds a link inside the current store. Store content (banner links, CTA
 * links) is stored relative to the store root, e.g. "/c/kanjivaram".
 * External links are returned unchanged.
 */
export function storeHref(basePath: string, path: string): string {
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('mailto:')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return basePath || '/';
  return `${basePath}${clean}`;
}

export const storePaths = {
  home: '/',
  category: (slug: string) => `/c/${slug}`,
  product: (slug: string) => `/p/${slug}`,
  cart: '/cart',
  checkout: '/checkout',
  contact: '/contact',
};
