import { z } from 'zod';

// Product photo rules shared by the browser (before uploading) and the
// server actions (the real check).

/** Formats the browser produces after resizing (WebP where supported). */
export const IMAGE_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

/** After resizing a photo is usually 150–400 KB; this leaves headroom. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 12;
/** Longest side after resizing, in pixels. */
export const MAX_IMAGE_SIDE = 1600;

/** Size to draw an image at so its longest side is at most `max`. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** R2 key for a new product photo: tenants/{t}/products/{p}/{id}.{ext}. */
export function productImageKey(
  tenantId: string,
  productId: string,
  imageId: string,
  type: ImageType,
): string {
  return `tenants/${tenantId}/products/${productId}/${imageId}.${IMAGE_TYPES[type]}`;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Whether `key` is a photo key made by productImageKey for this product. */
export function isProductImageKey(
  key: string,
  tenantId: string,
  productId: string,
): boolean {
  return new RegExp(
    `^tenants/${tenantId}/products/${productId}/${UUID}\\.(webp|jpg)$`,
  ).test(key);
}

const dimension = z.number().int().min(1).max(10_000);

export const uploadRequestSchema = z.object({
  productId: z.uuid(),
  files: z
    .array(
      z.object({
        type: z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]),
        size: z.number().int().min(1).max(MAX_IMAGE_BYTES),
      }),
    )
    .min(1)
    .max(MAX_IMAGES_PER_PRODUCT),
});

export const addImagesSchema = z.object({
  productId: z.uuid(),
  images: z
    .array(
      z.object({
        key: z.string().max(300),
        width: dimension,
        height: dimension,
      }),
    )
    .min(1)
    .max(MAX_IMAGES_PER_PRODUCT),
});

export const imageAltSchema = z.object({
  id: z.uuid(),
  alt: z.string().trim().max(200, 'Keep it under 200 characters'),
});

export const imageOrderSchema = z.object({
  productId: z.uuid(),
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAX_IMAGES_PER_PRODUCT * 2)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate photo'),
});
