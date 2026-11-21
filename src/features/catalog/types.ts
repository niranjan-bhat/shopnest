/**
 * Shapes the storefront renders. Query functions map database rows into these;
 * templates only ever see these types, never rows or the database.
 */

export type MediaImage = {
  key: string;
  alt: string;
  width: number;
  height: number;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  /** Listed in the store's top menu (header and phone menu). */
  inMenu: boolean;
  image: MediaImage | null;
};

export type Banner = {
  id: string;
  image: MediaImage;
  heading: string | null;
  /** Store-relative link such as "/c/kanjivaram". */
  link: string | null;
};

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  /** Lowest price across variants, in paise; null when price is on request. */
  pricePaise: number | null;
  compareAtPaise: number | null;
  image: MediaImage | null;
  hoverImage: MediaImage | null;
  inStock: boolean;
  /** Fewer than this many in stock shows "only a few left". */
  lowStock: boolean;
};

/** A product card plus the fields category filters and sorting need. */
export type CatalogItem = ProductCardData & {
  categorySlugs: string[];
  isFeatured: boolean;
  createdAt: string;
  colour: string | null;
  fabric: string | null;
  sizes: string[];
};

export type ProductVariant = {
  id: string;
  sku: string | null;
  options: Record<string, string>;
  pricePaise: number | null;
  stock: number;
  trackInventory: boolean;
  available: boolean;
};

export type ProductDetail = ProductCardData & {
  description: string | null;
  attributes: { label: string; value: string }[];
  images: MediaImage[];
  variants: ProductVariant[];
  /** Option names in display order, e.g. ["colour", "size"]. */
  optionNames: string[];
  categories: { slug: string; name: string }[];
  /** Search-engine title and description set by the merchant, if any. */
  seo: { title: string | null; description: string | null };
};
