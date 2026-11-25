import type { MediaImage, ProductImage } from './types';

// Colours are typed by merchants, so "Red", "red" and " Red " are one colour.
// Pure, for the server and the browser.

export function colourKey(colour: string): string {
  return colour.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The colour in `colours` that matches, as spelled there, or null. */
export function matchColour(
  colours: string[],
  wanted: string | null | undefined,
): string | null {
  if (!wanted) return null;
  const key = colourKey(wanted);
  return colours.find((colour) => colourKey(colour) === key) ?? null;
}

/** Unique colours, as first spelled. */
export function uniqueColours(values: (string | undefined)[]): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    if (value && !byKey.has(colourKey(value))) {
      byKey.set(colourKey(value), value);
    }
  }
  return [...byKey.values()];
}

/**
 * The photos to show for a colour: its own, then those for every colour.
 * With none of its own (or no colour chosen), all of them.
 */
export function imagesForColour(
  images: ProductImage[],
  colour: string | null | undefined,
): MediaImage[] {
  if (!colour) return images;
  const key = colourKey(colour);
  const own = images.filter((i) => i.colour && colourKey(i.colour) === key);
  if (own.length === 0) return images;
  return [...own, ...images.filter((i) => i.colour === null)];
}
