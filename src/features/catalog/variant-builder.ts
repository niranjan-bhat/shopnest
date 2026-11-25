import { sortSizes } from './mappers';

// Builds the variant rows of the product form from the sizes and colours a
// merchant picks. Pure, so the browser can rebuild the table on every change.

export type OptionName = 'size' | 'colour';
export type VariantOptions = Partial<Record<OptionName, string>>;

/** One row of the variant table, as the form holds it (strings as typed). */
export type VariantDraft = {
  /** The saved variant's id; null for a row not saved yet. */
  id: string | null;
  options: VariantOptions;
  sku: string;
  /** Rupees; empty means "use the product price". */
  price: string;
  stock: string;
  /** The saved stock this row was shown with; empty for a new row. */
  stockWas: string;
  trackInventory: boolean;
};

export type OptionLists = { sizes: string[]; colours: string[] };

/** A stable key for a set of options, independent of key order. */
export function optionKey(options: VariantOptions): string {
  return JSON.stringify([options.colour ?? null, options.size ?? null]);
}

export function emptyVariant(options: VariantOptions = {}): VariantDraft {
  return {
    id: null,
    options,
    sku: '',
    price: '',
    stock: '0',
    stockWas: '',
    trackInventory: true,
  };
}

/**
 * Every colour × size combination, colours first. A row the form already has
 * for a combination is kept as it is; otherwise a saved variant with the same
 * options is brought back (so removing and re-adding "M" before saving keeps
 * its id, its stock and any carts holding it). With no sizes or colours the
 * product has a single variant.
 */
export function buildVariants(
  { sizes, colours }: OptionLists,
  current: VariantDraft[],
  saved: VariantDraft[] = [],
): VariantDraft[] {
  const colourList = colours.length > 0 ? colours : [undefined];
  const sizeList = sizes.length > 0 ? sortSizes(sizes) : [undefined];
  const known = new Map<string, VariantDraft>();
  for (const row of [...saved, ...current])
    known.set(optionKey(row.options), row);

  const rows: VariantDraft[] = [];
  for (const colour of colourList) {
    for (const size of sizeList) {
      const options: VariantOptions = {};
      if (colour !== undefined) options.colour = colour;
      if (size !== undefined) options.size = size;
      rows.push(known.get(optionKey(options)) ?? emptyVariant(options));
    }
  }
  return rows;
}

/** The sizes and colours a set of saved variants uses, for loading a form. */
export function optionListsOf(
  variants: { options: VariantOptions }[],
): OptionLists {
  const sizes = new Set<string>();
  const colours = new Set<string>();
  for (const { options } of variants) {
    if (options.size) sizes.add(options.size);
    if (options.colour) colours.add(options.colour);
  }
  return { sizes: sortSizes(sizes), colours: [...colours] };
}

/** "Rust · M" for a row, or "Default" for a product without options. */
export function variantLabel(options: VariantOptions): string {
  const parts = [options.colour, options.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Default';
}
