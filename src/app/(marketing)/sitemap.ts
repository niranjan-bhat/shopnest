import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/features/marketing/site';

/** The platform site's pages; stores get their own sitemaps in Phase 6. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/privacy', '/terms'].map((path) => ({
    url: new URL(path, siteOrigin()).href,
  }));
}
