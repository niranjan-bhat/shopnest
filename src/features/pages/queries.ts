import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { tenantTag } from '@/features/tenants/queries';
import { check } from '@/lib/supabase/result';
import { storefrontDb } from '@/lib/supabase/storefront';
import {
  isPageSlug,
  PAGE_SLUGS,
  toBlocks,
  type ContentBlock,
  type PageSlug,
} from './content';

// Public storefront reads. RLS already limits them to published pages of
// live stores; every query still filters by tenant_id. Cached per store and
// expired with tenantTag when the merchant saves a page.

export type PageLink = { slug: PageSlug; title: string };

export type StorePage = PageLink & { blocks: ContentBlock[] };

/** Published pages, in the fixed page order, for menus and the footer. */
export async function listPublishedPages(
  tenantId: string,
): Promise<PageLink[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(tenantTag(tenantId));
  const rows = check(
    await storefrontDb()
      .from('store_pages')
      .select('slug, title')
      .eq('tenant_id', tenantId),
    'store_pages',
  );
  return rows
    .filter((row): row is PageLink => isPageSlug(row.slug))
    .sort((a, b) => PAGE_SLUGS.indexOf(a.slug) - PAGE_SLUGS.indexOf(b.slug));
}

/** One published page, ready to render; null if it is not published. */
export async function getPublishedPage(
  tenantId: string,
  slug: string,
): Promise<StorePage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(tenantTag(tenantId));
  if (!isPageSlug(slug)) return null;
  const row = check(
    await storefrontDb()
      .from('store_pages')
      .select('slug, title, body')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .maybeSingle(),
    'store_pages',
  );
  if (!row) return null;
  const blocks = toBlocks(row.body);
  return blocks.length ? { slug, title: row.title, blocks } : null;
}
