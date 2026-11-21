'use server';

import { refresh, updateTag } from 'next/cache';
import { isBrandingKey } from '@/features/media/rules';
import { requireStoreForAction } from '@/features/tenants/access';
import { tenantTag } from '@/features/tenants/queries';
import type { ActionResult } from '@/lib/action-result';
import { isR2Configured, statObject } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase/server';
import { getThemeEditor } from './editor';
import { themeLookSchema, withLook, type ThemeLook } from './look';
import type { ThemeConfig } from './schema';

// The storefront editor. Edits go to the draft; shoppers see a change only
// after publishTheme copies the draft to the published theme.

const NO_THEME =
  'This store has no theme yet. Ask the Zarify team to set it up.';

type LookField = keyof ThemeLook;

async function writeDraft(tenantId: string, draft: ThemeConfig) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('tenant_themes')
    .update({ draft, template_key: draft.templateKey })
    .eq('tenant_id', tenantId)
    .select('tenant_id');
  if (error) throw new Error(`Saving theme failed: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * A logo or favicon key is accepted if it is unchanged, or a new upload of
 * this store's of the right kind that really is in storage.
 */
async function imageKeyProblem(
  key: string | null,
  kind: 'logo' | 'favicon',
  tenantId: string,
  known: (string | null | undefined)[],
): Promise<string | null> {
  if (key === null || known.includes(key)) return null;
  if (!isR2Configured() || !isBrandingKey(key, tenantId, kind)) {
    return 'That image is invalid. Upload it again.';
  }
  const stat = await statObject(key);
  return stat ? null : 'That upload did not finish. Upload it again.';
}

/** Saves branding, colours, fonts, corners and announcement to the draft. */
export async function saveThemeLook(
  input: unknown,
): Promise<ActionResult<LookField>> {
  const { store } = await requireStoreForAction();
  const parsed = themeLookSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<LookField, string>> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as LookField] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const editor = await getThemeEditor(store.id);
  if (!editor) return { ok: false, error: NO_THEME };

  const look = parsed.data;
  const [logo, favicon] = await Promise.all([
    imageKeyProblem(look.logoKey, 'logo', store.id, [
      editor.draft.branding.logoKey,
      editor.published?.branding.logoKey,
    ]),
    imageKeyProblem(look.faviconKey, 'favicon', store.id, [
      editor.draft.branding.faviconKey,
      editor.published?.branding.faviconKey,
    ]),
  ]);
  if (logo || favicon) {
    return {
      ok: false,
      fieldErrors: {
        ...(logo ? { logoKey: logo } : {}),
        ...(favicon ? { faviconKey: favicon } : {}),
      },
    };
  }

  if (!(await writeDraft(store.id, withLook(editor.draft, look)))) {
    return { ok: false, error: NO_THEME };
  }
  refresh();
  return { ok: true };
}

/** Makes the draft live. */
export async function publishTheme(): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const editor = await getThemeEditor(store.id);
  if (!editor) return { ok: false, error: NO_THEME };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('tenant_themes')
    .update({
      draft: editor.draft,
      published: editor.draft,
      template_key: editor.draft.templateKey,
      published_at: new Date().toISOString(),
    })
    .eq('tenant_id', store.id);
  if (error) throw new Error(`Publishing failed: ${error.message}`);
  // Store pages are cached per store; expire them so shoppers see it now.
  updateTag(tenantTag(store.id));
  refresh();
  return { ok: true };
}

/** Throws away unpublished changes: the draft becomes the live theme. */
export async function discardThemeChanges(): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const editor = await getThemeEditor(store.id);
  if (!editor) return { ok: false, error: NO_THEME };
  if (!editor.published) {
    return { ok: false, error: 'Nothing is published yet to go back to.' };
  }
  await writeDraft(store.id, editor.published);
  refresh();
  return { ok: true };
}
