import { colourKey, uniqueColours } from './colours';
import { sortSizes } from './mappers';
import type { ProductVariant } from './types';

export type OptionSelection = Record<string, string>;

/** Values for one option, in display order (sizes in garment order). */
export function optionValues(
  variants: ProductVariant[],
  name: string,
): string[] {
  const values = variants
    .map((v) => v.options[name])
    .filter((v): v is string => v !== undefined);
  if (name === 'size') return sortSizes(values);
  return name === 'colour' ? uniqueColours(values) : [...new Set(values)];
}

const matches = (
  variant: ProductVariant,
  selection: OptionSelection,
  ignore?: string,
) =>
  Object.entries(selection).every(
    ([name, value]) => name === ignore || variant.options[name] === value,
  );

/** The variant matching every option name, or undefined if incomplete. */
export function findVariant(
  variants: ProductVariant[],
  optionNames: string[],
  selection: OptionSelection,
): ProductVariant | undefined {
  if (optionNames.some((name) => selection[name] === undefined)) {
    return undefined;
  }
  return variants.find((v) => matches(v, selection));
}

/**
 * Whether picking `value` for `name` (keeping the other choices) leads to a
 * variant that can be bought. Used to strike through sold-out sizes.
 */
export function isValueAvailable(
  variants: ProductVariant[],
  selection: OptionSelection,
  name: string,
  value: string,
): boolean {
  return variants.some(
    (v) =>
      v.available && v.options[name] === value && matches(v, selection, name),
  );
}

/**
 * Starting selection: products without options select their only variant;
 * otherwise only non-size options are preselected, from the first variant in
 * stock, so shoppers always choose their size themselves. The cover photo's
 * colour comes first, if it can be bought.
 */
export function initialSelection(
  variants: ProductVariant[],
  optionNames: string[],
  coverColour?: string | null,
): OptionSelection {
  const available = variants.filter((v) => v.available);
  const first =
    available.find(
      (v) =>
        coverColour &&
        v.options.colour &&
        colourKey(v.options.colour) === colourKey(coverColour),
    ) ??
    available[0] ??
    variants[0];
  if (!first) return {};
  return Object.fromEntries(
    optionNames
      .filter((name) => name !== 'size' && first.options[name] !== undefined)
      .map((name) => [name, first.options[name] as string]),
  );
}

/** Whether any variant that fits the choices so far can be bought. */
export function canBuy(
  variants: ProductVariant[],
  selection: OptionSelection,
): boolean {
  return variants.some((v) => v.available && matches(v, selection));
}
