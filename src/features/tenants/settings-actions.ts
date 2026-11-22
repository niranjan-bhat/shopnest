'use server';

import { refresh, updateTag } from 'next/cache';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStoreForAction } from './access';
import { tenantTag } from './queries';
import {
  settingsRow,
  storeSettingsSchema,
  type StoreSettingsField,
} from './settings';

/**
 * Saves the store's name, WhatsApp number and contact details. They go live
 * at once: the store's cached pages are expired.
 */
export async function saveStoreSettings(
  input: unknown,
): Promise<ActionResult<StoreSettingsField>> {
  const { store } = await requireStoreForAction();
  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<StoreSettingsField, string>> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as StoreSettingsField] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('tenants')
    .update(settingsRow(parsed.data))
    .eq('id', store.id)
    .select('id');
  if (error) throw new Error(`Saving store details failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'You can no longer change this store.' };
  }
  updateTag(tenantTag(store.id));
  refresh();
  return { ok: true };
}
