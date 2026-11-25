/**
 * Product details for clothing, in the order the product page shows them.
 * The dashboard's product form offers these as fields; the storefront uses
 * the labels and order. Details a merchant adds beyond these are stored
 * under their own label as the key and listed after these, A–Z.
 */
export const CLOTHING_ATTRIBUTES = [
  { key: 'fabric', label: 'Fabric', example: 'Pure mulberry silk' },
  { key: 'zari', label: 'Zari', example: 'Gold zari' },
  { key: 'fit', label: 'Fit', example: 'Relaxed' },
  { key: 'length', label: 'Length', example: '5.5 m saree + 0.8 m blouse' },
  { key: 'blouse', label: 'Blouse piece', example: 'Included, unstitched' },
  { key: 'includes', label: 'Includes', example: 'Kurta, pants, dupatta' },
  { key: 'occasion', label: 'Occasion', example: 'Wedding' },
  { key: 'care', label: 'Care', example: 'Dry clean only' },
] as const;

export type ClothingAttributeKey = (typeof CLOTHING_ATTRIBUTES)[number]['key'];

export const CLOTHING_ATTRIBUTE_KEYS: readonly ClothingAttributeKey[] =
  CLOTHING_ATTRIBUTES.map((a) => a.key);

/** Size values in garment order; also the quick picks in the product form. */
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'];
