import { z } from 'zod';
import { sortSizes } from './mappers';
import type { CatalogItem } from './types';

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

/** Price bands in paise. `max` is exclusive; null means no upper bound. */
export const PRICE_BANDS = [
  { value: 'under-5k', label: 'Under ₹5,000', min: 0, max: 500_000 },
  { value: '5k-10k', label: '₹5,000 – ₹10,000', min: 500_000, max: 1_000_000 },
  {
    value: '10k-25k',
    label: '₹10,000 – ₹25,000',
    min: 1_000_000,
    max: 2_500_000,
  },
  { value: '25k-plus', label: 'Above ₹25,000', min: 2_500_000, max: null },
] as const;
export type PriceBand = (typeof PRICE_BANDS)[number]['value'];

export type CatalogFilters = {
  sort: SortOption;
  price: PriceBand[];
  colour: string[];
  fabric: string[];
  size: string[];
  inStock: boolean;
};

/** Search params arrive as string | string[] | undefined. */
type RawParams = Record<string, string | string[] | undefined>;

const list = <T extends z.ZodType<string>>(item: T) =>
  z
    .union([item, z.array(item)])
    .optional()
    .catch(undefined)
    .transform((value) =>
      value === undefined ? [] : Array.isArray(value) ? value : [value],
    );

const freeText = z.string().trim().min(1).max(60);

const filtersSchema = z.object({
  sort: z
    .enum(SORT_OPTIONS.map((o) => o.value) as [SortOption, ...SortOption[]])
    .catch('featured'),
  price: list(
    z.enum(PRICE_BANDS.map((b) => b.value) as [PriceBand, ...PriceBand[]]),
  ),
  colour: list(freeText),
  fabric: list(freeText),
  size: list(freeText),
  inStock: z
    .union([z.literal('1'), z.array(z.string())])
    .optional()
    .catch(undefined)
    .transform((value) => value !== undefined),
});

/**
 * Parses URL search params into filters. Anything unknown or malformed is
 * ignored rather than rejected, since these come straight from the URL.
 */
export function parseCatalogFilters(params: RawParams): CatalogFilters {
  return filtersSchema.parse({
    sort: params.sort ?? 'featured',
    price: params.price,
    colour: params.colour,
    fabric: params.fabric,
    size: params.size,
    inStock: params.inStock,
  });
}

function inPriceBands(item: CatalogItem, bands: PriceBand[]): boolean {
  if (bands.length === 0) return true;
  if (item.pricePaise === null) return false;
  const price = item.pricePaise;
  return PRICE_BANDS.some(
    (band) =>
      bands.includes(band.value) &&
      price >= band.min &&
      (band.max === null || price < band.max),
  );
}

const matchesAny = (value: string | null, wanted: string[]) =>
  wanted.length === 0 || (value !== null && wanted.includes(value));

/** Price-on-request items always sort after priced ones. */
function comparePrice(a: CatalogItem, b: CatalogItem, direction: 1 | -1) {
  if (a.pricePaise === null && b.pricePaise === null) return 0;
  if (a.pricePaise === null) return 1;
  if (b.pricePaise === null) return -1;
  return (a.pricePaise - b.pricePaise) * direction;
}

const byNewest = (a: CatalogItem, b: CatalogItem) =>
  b.createdAt.localeCompare(a.createdAt);

export function sortCatalog(
  items: CatalogItem[],
  sort: SortOption,
): CatalogItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'newest':
      return sorted.sort(byNewest);
    case 'price-asc':
      return sorted.sort((a, b) => comparePrice(a, b, 1) || byNewest(a, b));
    case 'price-desc':
      return sorted.sort((a, b) => comparePrice(a, b, -1) || byNewest(a, b));
    case 'featured':
      return sorted.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          Number(b.inStock) - Number(a.inStock) ||
          byNewest(a, b),
      );
  }
}

export function filterCatalog(
  items: CatalogItem[],
  filters: CatalogFilters,
): CatalogItem[] {
  const filtered = items.filter(
    (item) =>
      inPriceBands(item, filters.price) &&
      matchesAny(item.colour, filters.colour) &&
      matchesAny(item.fabric, filters.fabric) &&
      (filters.size.length === 0 ||
        item.sizes.some((s) => filters.size.includes(s))) &&
      (!filters.inStock || item.inStock),
  );
  return sortCatalog(filtered, filters.sort);
}

export type FacetValue = { value: string; label: string; count: number };
export type CatalogFacets = {
  price: FacetValue[];
  colour: FacetValue[];
  fabric: FacetValue[];
  size: FacetValue[];
};

function countValues(values: (string | null)[]): FacetValue[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Filter options for a set of items; options with no items are left out. */
export function catalogFacets(items: CatalogItem[]): CatalogFacets {
  const sizeOrder = new Map(
    sortSizes(items.flatMap((item) => item.sizes)).map((s, i) => [s, i]),
  );
  return {
    price: PRICE_BANDS.map((band) => ({
      value: band.value,
      label: band.label,
      count: items.filter((item) => inPriceBands(item, [band.value])).length,
    })).filter((facet) => facet.count > 0),
    colour: countValues(items.map((i) => i.colour)),
    fabric: countValues(items.map((i) => i.fabric)),
    size: countValues(items.flatMap((i) => i.sizes)).sort(
      (a, b) => (sizeOrder.get(a.value) ?? 0) - (sizeOrder.get(b.value) ?? 0),
    ),
  };
}

/** Number of active filters, for the mobile "Filters (3)" button. */
export function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.price.length +
    filters.colour.length +
    filters.fabric.length +
    filters.size.length +
    (filters.inStock ? 1 : 0)
  );
}
