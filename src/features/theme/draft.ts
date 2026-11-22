import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ThemeConfig } from './schema';

// Shared by the storefront editor's Server Actions. Kept out of the
// 'use server' files so it is not callable from the browser itself.

export const NO_THEME =
  'This store has no theme yet. Ask the Zarify team to set it up.';

/** Replaces the store's draft theme; false when the store has no theme. */
export async function writeDraft(
  tenantId: string,
  draft: ThemeConfig,
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('tenant_themes')
    .update({ draft, template_key: draft.templateKey })
    .eq('tenant_id', tenantId)
    .select('tenant_id');
  if (error) throw new Error(`Saving theme failed: ${error.message}`);
  return (data ?? []).length > 0;
}
