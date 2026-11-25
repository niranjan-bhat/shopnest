'use server';

import { randomUUID } from 'node:crypto';
import { catalogChanged } from '@/features/catalog/cache';
import { matchColour } from '@/features/catalog/colours';
import { toStringRecord } from '@/features/catalog/mappers';
import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import {
  deleteObjects,
  isR2Configured,
  signedUploadUrl,
  statObject,
} from '@/lib/r2';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  addImagesSchema,
  IMAGE_TYPES,
  imageAltSchema,
  imageColourSchema,
  imageOrderSchema,
  isProductImageKey,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  productImageKey,
  uploadRequestSchema,
  type ImageType,
} from './rules';

// Product photos. Uploading is two steps around a direct browser → R2 PUT:
//   1. prepareProductImageUploads: signed URLs for new keys;
//   2. the browser uploads each file to its URL;
//   3. addProductImages: checks the files arrived, then records them.
// Every step checks the user manages the active store and that the product
// is that store's.

const NOT_SET_UP = 'Photo uploads are not set up for this site yet.';
const GONE = 'That product no longer exists.';

export type PreparedUpload = {
  key: string;
  uploadUrl: string;
  contentType: ImageType;
};

async function productInStore(tenantId: string, productId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, product_images(count)')
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`Loading product failed: ${error.message}`);
  if (!data) return null;
  return { imageCount: data.product_images[0]?.count ?? 0 };
}

const tooMany = (room: number) =>
  room <= 0
    ? `A product can have up to ${MAX_IMAGES_PER_PRODUCT} photos. Delete one to add another.`
    : `Only ${room} more photo${room === 1 ? '' : 's'} fit (up to ${MAX_IMAGES_PER_PRODUCT}).`;

export async function prepareProductImageUploads(
  input: unknown,
): Promise<
  { ok: true; uploads: PreparedUpload[] } | { ok: false; error: string }
> {
  const { store } = await requireStoreForAction();
  if (!isR2Configured()) return { ok: false, error: NOT_SET_UP };
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Those files cannot be uploaded.' };
  }
  const { productId, files } = parsed.data;
  const product = await productInStore(store.id, productId);
  if (!product) return { ok: false, error: GONE };
  const room = MAX_IMAGES_PER_PRODUCT - product.imageCount;
  if (files.length > room) return { ok: false, error: tooMany(room) };

  const uploads = await Promise.all(
    files.map(async (file) => {
      const key = productImageKey(store.id, productId, randomUUID(), file.type);
      return {
        key,
        uploadUrl: await signedUploadUrl(key, file.type, file.size),
        contentType: file.type,
      };
    }),
  );
  return { ok: true, uploads };
}

export async function addProductImages(input: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  if (!isR2Configured()) return { ok: false, error: NOT_SET_UP };
  const parsed = addImagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Those photos are invalid.' };
  const { productId, images } = parsed.data;
  if (!images.every((i) => isProductImageKey(i.key, store.id, productId))) {
    return { ok: false, error: 'Those photos are invalid.' };
  }
  const product = await productInStore(store.id, productId);
  if (!product) {
    await deleteObjects(images.map((i) => i.key));
    return { ok: false, error: GONE };
  }
  if (images.length > MAX_IMAGES_PER_PRODUCT - product.imageCount) {
    await deleteObjects(images.map((i) => i.key));
    return {
      ok: false,
      error: tooMany(MAX_IMAGES_PER_PRODUCT - product.imageCount),
    };
  }

  // Only record files that really arrived, at an allowed type and size.
  const stats = await Promise.all(images.map((i) => statObject(i.key)));
  const allowed = new Set<string>(Object.keys(IMAGE_TYPES));
  if (
    stats.some(
      (s) =>
        !s ||
        s.size > MAX_IMAGE_BYTES ||
        !s.contentType ||
        !allowed.has(s.contentType),
    )
  ) {
    await deleteObjects(images.map((i) => i.key));
    return { ok: false, error: 'An upload did not finish. Please try again.' };
  }

  const supabase = await createServerSupabase();
  const last = await supabase
    .from('product_images')
    .select('position')
    .eq('tenant_id', store.id)
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) throw new Error(last.error.message);
  const start = (last.data?.position ?? -1) + 1;

  const { error } = await supabase.from('product_images').insert(
    images.map((image, i) => ({
      tenant_id: store.id,
      product_id: productId,
      r2_key: image.key,
      width: image.width,
      height: image.height,
      position: start + i,
    })),
  );
  if (error) {
    await deleteObjects(images.map((i) => i.key));
    throw new Error(`Saving photos failed: ${error.message}`);
  }
  catalogChanged(store.id);
  return { ok: true };
}

export async function reorderProductImages(
  input: unknown,
): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = imageOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Could not save the order.' };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('reorder_product_images', {
    tid: store.id,
    pid: parsed.data.productId,
    ordered_ids: parsed.data.ids,
  });
  if (error?.code === '22023') {
    catalogChanged(store.id);
    return {
      ok: false,
      error: 'Photos changed in another window. Try again.',
    };
  }
  if (error) throw new Error(`Reordering photos failed: ${error.message}`);
  catalogChanged(store.id);
  return { ok: true };
}

export async function setProductImageAlt(
  input: unknown,
): Promise<ActionResult<'alt'>> {
  const { store } = await requireStoreForAction();
  const parsed = imageAltSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: { alt: parsed.error.issues[0]?.message ?? 'Invalid' },
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('product_images')
    .update({ alt: parsed.data.alt || null })
    .eq('tenant_id', store.id)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) throw new Error(`Saving description failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'That photo no longer exists.' };
  }
  catalogChanged(store.id);
  return { ok: true };
}

/** Tags a photo with one of its product's colours, or with none. */
export async function setProductImageColour(
  input: unknown,
): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = imageColourSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Choose a colour.' };
  const { id, colour } = parsed.data;

  const supabase = await createServerSupabase();
  const image = await supabase
    .from('product_images')
    .select('products(product_variants(options))')
    .eq('tenant_id', store.id)
    .eq('id', id)
    .maybeSingle();
  if (image.error) throw new Error(image.error.message);
  if (!image.data) return { ok: false, error: 'That photo no longer exists.' };
  const colours = (image.data.products?.product_variants ?? []).map(
    (variant) => toStringRecord(variant.options).colour ?? '',
  );
  const known = matchColour(colours, colour);
  if (colour !== null && known === null) {
    return {
      ok: false,
      error: 'The product no longer has that colour. Reload the page.',
    };
  }

  const { data, error } = await supabase
    .from('product_images')
    .update({ colour: known })
    .eq('tenant_id', store.id)
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`Saving photo colour failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'That photo no longer exists.' };
  }
  catalogChanged(store.id);
  return { ok: true };
}

export async function deleteProductImage(id: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = imageAltSchema.shape.id.safeParse(id);
  if (!parsed.success)
    return { ok: false, error: 'That photo no longer exists.' };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('product_images')
    .delete()
    .eq('tenant_id', store.id)
    .eq('id', parsed.data)
    .select('r2_key');
  if (error) throw new Error(`Deleting photo failed: ${error.message}`);
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'That photo no longer exists.' };
  }
  catalogChanged(store.id);
  // The row is gone, so the photo is off the store; the file goes next.
  if (isR2Configured()) {
    await deleteObjects(data.map((row) => row.r2_key)).catch((e: unknown) =>
      console.error('Photo file not deleted from R2', e),
    );
  }
  return { ok: true };
}
