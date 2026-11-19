import type { ThemeTokens } from './schema';

/** CSS custom properties a storefront root element receives. */
export type StoreCssVars = Record<`--store-${string}`, string>;

const RADIUS: Record<ThemeTokens['radius'], string> = {
  none: '0px',
  sm: '4px',
  md: '10px',
  lg: '18px',
};

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever of the candidates reads best on the given background. */
export function readableOn(background: string, candidates: string[]): string {
  return candidates.reduce((best, c) =>
    contrastRatio(background, c) > contrastRatio(background, best) ? c : best,
  );
}

/**
 * Turns theme tokens into CSS variables for the storefront root. Text colours
 * for filled buttons ("on-primary", "on-accent") are derived so merchants
 * cannot pick an unreadable combination.
 */
export function tokensToCssVars(tokens: ThemeTokens): StoreCssVars {
  const { primary, accent, background, text } = tokens.colors;
  const inks = [text, background, '#ffffff', '#000000'];
  return {
    '--store-primary': primary,
    '--store-on-primary': readableOn(primary, inks),
    '--store-accent': accent,
    '--store-on-accent': readableOn(accent, inks),
    '--store-bg': background,
    '--store-text': text,
    '--store-radius': RADIUS[tokens.radius],
  };
}
