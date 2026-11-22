'use server';

import { refresh } from 'next/cache';
import { catalogChanged } from '@/features/catalog/cache';
import {
  isBrandingKey,
  MAX_IMAGE_BYTES,
  UPLOAD_TYPES,
} from '@/features/media/rules';
import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import { deleteObjects, isR2Configured, statObject } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  bannerFormSchema,
  bannerIdSchema,
  bannerOrderSchema,
  bannerRow,
  MAX_BANNERS,
  newBannerSchema,
  type BannerField,
} from './banners';

// Banner library changes. They save at once, outside the theme draft: a
// banner reaches shoppers only through a home section that shows it. Every
// change expires the store's cached catalog (banners are cached with it).

const GONE = 'That banner no longer exists.';
const NOT_SET_UP = 'Image uploads are not set up for this site yet.';

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Partial<Record<BannerField, string>> = {};
  for (const issue of issues) {
    // Paths are ["values", field] for a new banner, [field] for an edit.
    const field = issue.path.at(-1) as BannerField;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/** Discards an uploaded file that will not be saved. */
async function discard(key: string) {
  await deleteObjects([key]).catch((e: unknown) =>
    console.error('Banner file not deleted from R2', e),
  );
}

/** Adds a banner from an image the browser has uploaded. */
export async function createBanner(
  input: unknown,
): Promise<ActionResult<BannerField>> {
  const { store } = await requireStoreForAction();
  if (!isR2Configured()) return { ok: false, error: NOT_SET_UP };
  const parsed = newBannerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const { imageKey, values } = parsed.data;
  if (!isBrandingKey(imageKey, store.id, 'banner')) {
    return { ok: false, error: 'That image is invalid. Upload it again.' };
  }

  const supabase = await createServerSupabase();
  const existing = await supabase
    .from('banners')
    .select('position')
    .eq('tenant_id', store.id)
    .order('position', { ascending: false });
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data.length >= MAX_BANNERS) {
    await discard(imageKey);
    return {
      ok: false,
      error: `A store can have up to ${MAX_BANNERS} banners. Delete one to add another.`,
    };
  }

  // Only save a file that really arrived, at an allowed type and size.
  const stat = await statObject(imageKey);
  const allowed = new Set<string>(Object.keys(UPLOAD_TYPES));
  if (
    !stat ||
    stat.size > MAX_IMAGE_BYTES ||
    !stat.contentType ||
    !allowed.has(stat.contentType)
  ) {
    if (stat) await discard(imageKey);
    return { ok: false, error: 'The upload did not finish. Upload it again.' };
  }

  const { error } = await supabase.from('banners').insert({
    tenant_id: store.id,
    image_key: imageKey,
    position: (existing.data[0]?.position ?? -1) + 1,
    ...bannerRow(values),
  });
  if (error) {
    await discard(imageKey);
    throw new Error(`Saving banner failed: ${error.message}`);
  }
  catalogChanged(store.id);
  return { ok: true };
}

/** Changes a banner's heading, link and dates. */
export async function updateBanner(
  id: unknown,
  input: unknown,
): Promise<ActionResult<BannerField>> {
  const { store } = await requireStoreForAction();
  const bannerId = bannerIdSchema.safeParse(id);
  if (!bannerId.success) return { ok: false, error: GONE };
  const parsed = bannerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('banners')
    .update(bannerRow(parsed.data))
    .eq('tenant_id', store.id)
    .eq('id', bannerId.data)
    .select('id');
  if (error) throw new Error(`Saving banner failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    refresh();
    return { ok: false, error: GONE };
  }
  catalogChanged(store.id);
  return { ok: true };
}

/** Saves the order of all of the store's banners. */
export async function reorderBanners(ids: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = bannerOrderSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'Could not save the new order.' };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('reorder_banners', {
    tid: store.id,
    ordered_ids: parsed.data,
  });
  if (error?.code === '22023') {
    // The list was stale: a banner was added or deleted meanwhile.
    refresh();
    return {
      ok: false,
      error: 'Banners changed in another window. Try again.',
    };
  }
  if (error) throw new Error(`Reordering banners failed: ${error.message}`);
  catalogChanged(store.id);
  return { ok: true };
}

/** Deletes a banner, then its image file. */
export async function deleteBanner(id: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const bannerId = bannerIdSchema.safeParse(id);
  if (!bannerId.success) return { ok: false, error: GONE };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('banners')
    .delete()
    .eq('tenant_id', store.id)
    .eq('id', bannerId.data)
    .select('image_key');
  if (error) throw new Error(`Deleting banner failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    refresh();
    return { ok: false, error: GONE };
  }
  catalogChanged(store.id);
  // The row is gone, so the banner is off the store; the file goes next.
  if (isR2Configured()) {
    await deleteObjects(data.map((row) => row.image_key)).catch((e: unknown) =>
      console.error('Banner file not deleted from R2', e),
    );
  }
  return { ok: true };
}
