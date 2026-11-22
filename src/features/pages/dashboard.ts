import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { PAGE_INFO, PAGE_SLUGS, type PageSlug } from './content';

export type EditablePage = {
  slug: PageSlug;
  title: string;
  body: string;
  isPublished: boolean;
  /** False until the merchant first saves it. */
  saved: boolean;
  updatedAt: string | null;
};

/** All five pages of the store, saved or not (as the signed-in member). */
export async function listEditablePages(
  tenantId: string,
): Promise<EditablePage[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('store_pages')
      .select('slug, title, body, is_published, updated_at')
      .eq('tenant_id', tenantId),
    'store_pages',
  );
  return PAGE_SLUGS.map((slug) => {
    const row = rows.find((r) => r.slug === slug);
    return row
      ? {
          slug,
          title: row.title,
          body: row.body,
          isPublished: row.is_published,
          saved: true,
          updatedAt: row.updated_at,
        }
      : {
          slug,
          title: PAGE_INFO[slug].title,
          body: '',
          isPublished: false,
          saved: false,
          updatedAt: null,
        };
  });
}
