import { z } from 'zod';
import { FONT_NAMES, themeTokensSchema, type ThemeConfig } from './schema';
import { contrastRatio } from './tokens';

// The storefront editor's "look" form: branding, colours, fonts, corners and
// the announcement bar. Sections are edited separately. Shared by the browser
// (instant feedback) and the save action (the real check).

export const RADIUS_OPTIONS = ['none', 'sm', 'md', 'lg'] as const;

export const themeLookSchema = z.object({
  colors: themeTokensSchema.shape.colors,
  headingFont: z.enum(FONT_NAMES),
  bodyFont: z.enum(FONT_NAMES),
  radius: z.enum(RADIUS_OPTIONS),
  logoKey: z.string().max(300).nullable(),
  faviconKey: z.string().max(300).nullable(),
  tagline: z.string().trim().max(120, 'Keep the tagline under 120 characters'),
  announcement: z
    .string()
    .trim()
    .max(140, 'Keep the announcement under 140 characters'),
});

export type ThemeLook = z.infer<typeof themeLookSchema>;

/** The look form's values for a theme. */
export function lookOf(theme: ThemeConfig): ThemeLook {
  return {
    colors: { ...theme.tokens.colors },
    headingFont: theme.tokens.fonts.heading,
    bodyFont: theme.tokens.fonts.body,
    radius: theme.tokens.radius,
    logoKey: theme.branding.logoKey,
    faviconKey: theme.branding.faviconKey,
    tagline: theme.branding.tagline ?? '',
    announcement: theme.announcement ?? '',
  };
}

/** The theme with the look applied; sections and template are kept. */
export function withLook(theme: ThemeConfig, look: ThemeLook): ThemeConfig {
  return {
    ...theme,
    tokens: {
      colors: { ...look.colors },
      fonts: { heading: look.headingFont, body: look.bodyFont },
      radius: look.radius,
    },
    branding: {
      logoKey: look.logoKey,
      faviconKey: look.faviconKey,
      ...(look.tagline ? { tagline: look.tagline } : {}),
    },
    announcement: look.announcement || undefined,
  };
}

/** WCAG AA asks 4.5:1 for body text, 3:1 for large text and links. */
const BODY_TEXT = 4.5;
const LARGE_TEXT = 3;

/**
 * Colour pairs shoppers would struggle to read. Text on buttons is chosen
 * automatically, so only the background pairings are checked.
 */
export function colourWarnings(
  colors: ThemeLook['colors'],
): { field: 'text' | 'primary'; message: string }[] {
  const warnings: { field: 'text' | 'primary'; message: string }[] = [];
  const text = contrastRatio(colors.text, colors.background);
  if (text < BODY_TEXT) {
    warnings.push({
      field: 'text',
      message: `Text on the background is hard to read (${text.toFixed(1)}:1; aim for at least 4.5:1).`,
    });
  }
  const primary = contrastRatio(colors.primary, colors.background);
  if (primary < LARGE_TEXT) {
    warnings.push({
      field: 'primary',
      message: `The brand colour is faint on the background (${primary.toFixed(1)}:1); links and prices may be hard to see.`,
    });
  }
  return warnings;
}

/** Whether two themes would render the same store (draft vs published). */
export function sameTheme(a: ThemeConfig, b: ThemeConfig | null): boolean {
  return b !== null && JSON.stringify(a) === JSON.stringify(b);
}
