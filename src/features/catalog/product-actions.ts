'use server';

import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import { deleteObjects, isR2Configured } from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase/server';
import { catalogChanged } from './cache';
import {
  payloadJson,
  productFormSchema,
  toProductPayload,
} from './product-schema';
import { idSchema } from './schemas';

// Product changes from the dashboard. Saving goes through save_product(),
// which writes the product, its categories and its variants in one
// transaction for the active store.

export type SaveProductResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const GONE = 'That product no longer exists.';

/** Creates a product (id null) or updates one. */
export async function saveProduct(
  id: string | null,
  input: unknown,
): Promise<SaveProductResult> {
  const { store } = await requireStoreForAction();
  const productId = id === null ? null : idSchema.safeParse(id);
  if (productId && !productId.success) return { ok: false, error: GONE };

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('save_product', {
    tid: store.id,
    product: payloadJson(toProductPayload(parsed.data)),
    ...(productId ? { pid: productId.data } : {}),
  });

  if (error) {
    if (error.code === '23505' && error.message.includes('slug')) {
      return {
        ok: false,
        fieldErrors: { slug: 'Another product already uses this URL.' },
      };
    }
    if (error.code === '23505' && error.message.includes('sku')) {
      return {
        ok: false,
        fieldErrors: {
          variants: 'A SKU here is already used by another product.',
        },
      };
    }
    if (error.code === 'P0002') return { ok: false, error: GONE };
    if (error.code === '23503' || error.code === '22023') {
      return {
        ok: false,
        error:
          'Something changed in another window (a category or variant). Reload the page and try again.',
      };
    }
    throw new Error(`Saving product failed: ${error.message}`);
  }

  catalogChanged(store.id);
  return { ok: true, id: data };
}

/** Deletes a product with its variants, photos and category links. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const productId = idSchema.safeParse(id);
  if (!productId.success) return { ok: false, error: GONE };
  const supabase = await createServerSupabase();
  // The photo rows go with the product (cascade); note their files first.
  const images = await supabase
    .from('product_images')
    .select('r2_key')
    .eq('tenant_id', store.id)
    .eq('product_id', productId.data);
  if (images.error) throw new Error(images.error.message);

  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('tenant_id', store.id)
    .eq('id', productId.data)
    .select('id');
  if (error) throw new Error(`Deleting product failed: ${error.message}`);
  if ((data ?? []).length === 0) return { ok: false, error: GONE };
  catalogChanged(store.id);

  const keys = images.data.map((row) => row.r2_key);
  if (keys.length > 0 && isR2Configured()) {
    await deleteObjects(keys).catch((e: unknown) =>
      console.error('Product photos not deleted from R2', e),
    );
  }
  return { ok: true };
}
