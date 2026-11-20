import { z } from 'zod';
import type { Json, Tables } from '@/types/database';
import type {
  Banner,
  CatalogItem,
  CategorySummary,
  MediaImage,
  ProductDetail,
  ProductVariant,
} from './types';

/** At or below this many units a variant counts as low stock. */
export const LOW_STOCK_THRESHOLD = 3;

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'];

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const stringRecord = z
  .record(z.string(), scalar)
  .catch({})
  .transform((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, String(value)]),
    ),
  );

/** Reads a jsonb object of simple values (attributes, variant options). */
export function toStringRecord(json: Json): Record<string, string> {
  return stringRecord.parse(json);
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  fabric: 'Fabric',
  zari: 'Zari',
  colour: 'Colour',
  length: 'Length',
  blouse: 'Blouse piece',
  occasion: 'Occasion',
  fit: 'Fit',
  includes: 'Includes',
  care: 'Care',
};

// jsonb does not keep object key order (Postgres stores shorter keys first),
// so display order is decided here. Unknown keys follow, alphabetically.

/** Order of product details on the product page. */
const ATTRIBUTE_ORDER = [
  'fabric',
  'zari',
  'colour',
  'fit',
  'length',
  'blouse',
  'includes',
  'occasion',
  'care',
] as const;

/** Order of variant options in pickers and cart labels ("Rust · M"). */
const OPTION_ORDER = ['colour', 'size'] as const;

/** Unique keys, preferred ones first in the given order, then A–Z. */
export function orderKeys(
  keys: Iterable<string>,
  preferred: readonly string[],
): string[] {
  const rank = (key: string) => {
    const i = preferred.indexOf(key);
    return i === -1 ? preferred.length : i;
  };
  return [...new Set(keys)].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
}

/** Variant options re-keyed in display order. */
export function orderOptions(
  options: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    orderKeys(Object.keys(options), OPTION_ORDER).map((key) => [
      key,
      options[key],
    ]),
  );
}

function attributeLabel(key: string): string {
  return (
    ATTRIBUTE_LABELS[key] ??
    key.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function toImage(row: Tables<'product_images'>): MediaImage {
  return {
    key: row.r2_key,
    alt: row.alt ?? '',
    width: row.width ?? 900,
    height: row.height ?? 1200,
  };
}

export function toCategory(row: Tables<'categories'>): CategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: row.image_key
      ? { key: row.image_key, alt: row.name, width: 800, height: 800 }
      : null,
  };
}

export function toBanner(row: Tables<'banners'>): Banner {
  return {
    id: row.id,
    image: {
      key: row.image_key,
      alt: row.heading ?? '',
      width: 1920,
      height: 960,
    },
    heading: row.heading,
    link: row.link,
  };
}

export function toVariant(
  row: Tables<'product_variants'>,
  product: Tables<'products'>,
): ProductVariant {
  const pricePaise =
    product.price_mode === 'on_request'
      ? null
      : (row.price_paise ?? product.price_paise);
  return {
    id: row.id,
    sku: row.sku,
    options: orderOptions(toStringRecord(row.options)),
    pricePaise,
    stock: row.stock_qty,
    trackInventory: row.track_inventory,
    available: !row.track_inventory || row.stock_qty > 0,
  };
}

/** Unique sizes in garment order (XS, S, M…), unknown sizes last. */
export function sortSizes(sizes: Iterable<string>): string[] {
  const rank = (size: string) => {
    const i = SIZE_ORDER.indexOf(size);
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...new Set(sizes)].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
}

export type ProductRows = {
  product: Tables<'products'>;
  variants: Tables<'product_variants'>[];
  images: Tables<'product_images'>[];
  categories: Tables<'categories'>[];
};

/** Builds the card + filter fields for one active product. */
export function toCatalogItem({
  product,
  variants,
  images,
  categories,
}: ProductRows): CatalogItem {
  const variantViews = variants.map((v) => toVariant(v, product));
  const prices = variantViews
    .map((v) => v.pricePaise)
    .filter((p): p is number => p !== null);
  const sortedImages = [...images].sort((a, b) => a.position - b.position);
  const attributes = toStringRecord(product.attributes);
  const available = variantViews.filter((v) => v.available);
  const trackedStock = available
    .filter((v) => v.trackInventory)
    .reduce((sum, v) => sum + v.stock, 0);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    pricePaise:
      product.price_mode === 'on_request' || prices.length === 0
        ? null
        : Math.min(...prices),
    compareAtPaise: product.compare_at_paise,
    image: sortedImages[0] ? toImage(sortedImages[0]) : null,
    hoverImage: sortedImages[1] ? toImage(sortedImages[1]) : null,
    inStock: available.length > 0,
    lowStock:
      available.length > 0 &&
      available.every((v) => v.trackInventory) &&
      trackedStock <= LOW_STOCK_THRESHOLD,
    categorySlugs: categories.map((c) => c.slug),
    isFeatured: product.is_featured,
    createdAt: product.created_at,
    colour: attributes.colour ?? null,
    fabric: attributes.fabric ?? null,
    sizes: sortSizes(
      variantViews.map((v) => v.options.size).filter((s): s is string => !!s),
    ),
  };
}

export function toProductDetail(rows: ProductRows): ProductDetail {
  const item = toCatalogItem(rows);
  const variants = rows.variants.map((v) => toVariant(v, rows.product));
  const optionNames = orderKeys(
    variants.flatMap((v) => Object.keys(v.options)),
    OPTION_ORDER,
  );
  const attributeValues = toStringRecord(rows.product.attributes);
  const attributes = orderKeys(
    Object.keys(attributeValues),
    ATTRIBUTE_ORDER,
  ).map((key) => ({ label: attributeLabel(key), value: attributeValues[key] }));

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    pricePaise: item.pricePaise,
    compareAtPaise: item.compareAtPaise,
    image: item.image,
    hoverImage: item.hoverImage,
    inStock: item.inStock,
    lowStock: item.lowStock,
    description: rows.product.description,
    attributes,
    images: [...rows.images]
      .sort((a, b) => a.position - b.position)
      .map(toImage),
    variants,
    optionNames,
    categories: rows.categories.map((c) => ({ slug: c.slug, name: c.name })),
  };
}
