'use server';

import { refresh, updateTag } from 'next/cache';
import { requireStoreForAction } from '@/features/tenants/access';
import { tenantTag } from '@/features/tenants/queries';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import { isPageSlug, pageFormSchema, type PageField } from './content';

/**
 * Saves one of the store's pages (creating it the first time). It goes live
 * at once when shown in the store; the store's cached pages are expired.
 */
export async function saveStorePage(
  slug: unknown,
  input: unknown,
): Promise<ActionResult<PageField>> {
  const { store } = await requireStoreForAction();
  if (typeof slug !== 'string' || !isPageSlug(slug)) {
    return { ok: false, error: 'That page does not exist.' };
  }
  const parsed = pageFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<PageField, string>> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as PageField] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('store_pages').upsert(
    {
      tenant_id: store.id,
      slug,
      title: parsed.data.title,
      body: parsed.data.body,
      is_published: parsed.data.isPublished,
    },
    { onConflict: 'tenant_id,slug' },
  );
  if (error) throw new Error(`Saving page failed: ${error.message}`);
  updateTag(tenantTag(store.id));
  refresh();
  return { ok: true };
}
