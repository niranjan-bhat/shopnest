import { z } from 'zod';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Image upload rules shared by the browser (before uploading) and the
// server actions (the real check): product photos, logos, favicons and
// banners.

/** Every format the browser may produce after resizing. */
export const UPLOAD_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;
export type UploadType = keyof typeof UPLOAD_TYPES;

/** Product photos: WebP, or JPEG where the browser cannot make WebP. */
export const IMAGE_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

/** Store images other than product photos. */
export const BRANDING_KINDS = ['logo', 'favicon', 'banner'] as const;
export type BrandingKind = (typeof BRANDING_KINDS)[number];

/**
 * Longest side after resizing, and the format to use where WebP is missing:
 * PNG for logos and favicons (keeps transparency), JPEG for banner photos.
 */
export const BRANDING_SIZES: Record<
  BrandingKind,
  { maxSide: number; fallback: 'image/png' | 'image/jpeg' }
> = {
  logo: { maxSide: 800, fallback: 'image/png' },
  favicon: { maxSide: 256, fallback: 'image/png' },
  banner: { maxSide: 2400, fallback: 'image/jpeg' },
};

/**
 * Logos must stay readable in the header: at most 8 times as wide as tall
 * (wider ones shrink to a sliver), and wide enough to look sharp.
 */
export const LOGO_LIMITS = { maxRatio: 8, minWidth: 200 } as const;

/** Why a logo of this size will not work in the header, or null. */
export function logoProblem(width: number, height: number): string | null {
  if (width / height > LOGO_LIMITS.maxRatio) {
    return 'This logo is too wide to read in the header. Use a version with less space around the name, or a stacked one.';
  }
  if (width < LOGO_LIMITS.minWidth) {
    return 'This logo is too small to look sharp. Upload one at least 600 pixels wide.';
  }
  return null;
}

/**
 * R2 key for a new store image: tenants/{t}/branding/{kind}-{id}.{ext}, or
 * tenants/{t}/banners/{id}.{ext} for banners.
 */
export function brandingKey(
  tenantId: string,
  kind: BrandingKind,
  imageId: string,
  type: UploadType,
): string {
  const ext = UPLOAD_TYPES[type];
  return kind === 'banner'
    ? `tenants/${tenantId}/banners/${imageId}.${ext}`
    : `tenants/${tenantId}/branding/${kind}-${imageId}.${ext}`;
}

/** Whether `key` is a key made by brandingKey for this store and kind. */
export function isBrandingKey(
  key: string,
  tenantId: string,
  kind: BrandingKind,
): boolean {
  const path =
    kind === 'banner' ? `banners/${UUID}` : `branding/${kind}-${UUID}`;
  return new RegExp(`^tenants/${tenantId}/${path}\\.(webp|jpg|png)$`).test(key);
}

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

/** null: the photo is for every colour. */
export const imageColourSchema = z.object({
  id: z.uuid(),
  colour: z.string().trim().min(1).max(40).nullable(),
});

export const imageOrderSchema = z.object({
  productId: z.uuid(),
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAX_IMAGES_PER_PRODUCT * 2)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate photo'),
});

export const brandingUploadSchema = z.object({
  kind: z.enum(BRANDING_KINDS),
  type: z.enum(Object.keys(UPLOAD_TYPES) as [UploadType, ...UploadType[]]),
  size: z.number().int().min(1).max(MAX_IMAGE_BYTES),
});
