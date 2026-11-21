import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { DEFAULT_THEME } from './defaults';
import { sameTheme } from './look';
import { parseThemeConfig, type ThemeConfig } from './schema';

export type ThemeEditorData = {
  /** What the editor shows and changes. */
  draft: ThemeConfig;
  /** What shoppers see; null until the first publish. */
  published: ThemeConfig | null;
  publishedAt: string | null;
  /** The draft differs from what is live. */
  hasChanges: boolean;
};

function parsed(raw: Json | null): ThemeConfig | null {
  if (raw === null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if (Object.keys(raw).length === 0) return null;
  }
  try {
    return parseThemeConfig(raw);
  } catch {
    return null;
  }
}

/**
 * The store's draft and published themes for the editor (as the signed-in
 * member; RLS lets only the store's team read the draft). Null when the
 * store has no theme row yet (super admins create it at onboarding).
 */
export async function getThemeEditor(
  tenantId: string,
): Promise<ThemeEditorData | null> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('tenant_themes')
      .select('draft, published, published_at')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    'tenant_themes',
  );
  if (!row) return null;
  const published = parsed(row.published);
  const draft = parsed(row.draft) ?? published ?? DEFAULT_THEME;
  return {
    draft,
    published,
    publishedAt: row.published_at,
    hasChanges: !sameTheme(draft, published),
  };
}
