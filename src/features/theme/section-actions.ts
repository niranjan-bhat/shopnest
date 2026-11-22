'use server';

import { refresh } from 'next/cache';
import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { getTemplate } from '@/templates/registry';
import { NO_THEME, writeDraft } from './draft';
import { getThemeEditor } from './editor';
import {
  allowedSectionTypes,
  homeSectionsSchema,
  sectionBannerIds,
  sectionsProblem,
} from './sections';

/**
 * Saves the home page's sections (the whole list, in order) to the draft.
 * Shoppers see them after the next publish.
 */
export async function saveHomeSections(input: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = homeSectionsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = issue?.path[0];
    return {
      ok: false,
      error:
        typeof index === 'number'
          ? `Section ${index + 1} is incomplete. Open it and check the highlighted fields.`
          : (issue?.message ?? 'Could not save the sections.'),
    };
  }
  const editor = await getThemeEditor(store.id);
  if (!editor) return { ok: false, error: NO_THEME };

  const supabase = await createServerSupabase();
  const banners = check(
    await supabase.from('banners').select('id').eq('tenant_id', store.id),
    'banners',
  );
  const template = getTemplate(editor.draft.templateKey);
  // Sections already in the draft may stay (they are simply not shown if
  // the store can no longer use them), so a merchant is never stuck; new
  // ones must be allowed.
  const allowed = new Set([
    ...allowedSectionTypes(template.sections),
    ...editor.draft.sections.map((s) => s.type),
  ]);
  const problem = sectionsProblem(
    parsed.data,
    [...allowed],
    // Banners the draft already names stay accepted even if deleted since,
    // so other edits still save; the editor flags those sections.
    new Set([
      ...banners.map((b) => b.id),
      ...editor.draft.sections.flatMap(sectionBannerIds),
    ]),
  );
  if (problem) {
    refresh();
    return { ok: false, error: problem };
  }

  if (
    !(await writeDraft(store.id, { ...editor.draft, sections: parsed.data }))
  ) {
    return { ok: false, error: NO_THEME };
  }
  refresh();
  return { ok: true };
}
