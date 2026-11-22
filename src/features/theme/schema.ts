import { z } from 'zod';
import type { Json } from '@/types/database';

/** Fonts merchants can pick. Each one is loaded through next/font in fonts.ts. */
export const FONT_NAMES = [
  'Cormorant Garamond',
  'Playfair Display',
  'Marcellus',
  'Lora',
  'Inter',
  'DM Sans',
] as const;
export type FontName = (typeof FONT_NAMES)[number];

const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'must be a 6-digit hex colour like #7A1F2B');

export const themeTokensSchema = z.object({
  colors: z.object({
    primary: hexColor,
    accent: hexColor,
    background: hexColor,
    text: hexColor,
  }),
  fonts: z.object({
    heading: z.enum(FONT_NAMES),
    body: z.enum(FONT_NAMES),
  }),
  radius: z.enum(['none', 'sm', 'md', 'lg']),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const brandingSchema = z.object({
  logoKey: z.string().min(1).nullable().default(null),
  /** The logo's size in pixels, so the header can fit it to its shape. */
  logoWidth: z.number().int().min(1).max(10_000).optional(),
  logoHeight: z.number().int().min(1).max(10_000).optional(),
  faviconKey: z.string().min(1).nullable().default(null),
  tagline: z.string().max(120).optional(),
});
export type Branding = z.infer<typeof brandingSchema>;

const href = z.string().max(300);

/**
 * The section contract shared by every template. A template renders the
 * section types it supports; anything else is skipped.
 */
export const sectionSchemas = {
  hero: z.object({
    type: z.literal('hero'),
    props: z.object({
      /** Banners to rotate; all active banners when omitted. */
      bannerIds: z.array(z.string()).optional(),
      eyebrow: z.string().max(60).optional(),
      subheading: z.string().max(200).optional(),
      ctaLabel: z.string().max(40).default('Shop now'),
      ctaHref: href.default('/'),
    }),
  }),
  categoryTiles: z.object({
    type: z.literal('categoryTiles'),
    props: z.object({
      title: z.string().max(80).default('Shop by category'),
      limit: z.number().int().min(1).max(12).default(6),
    }),
  }),
  featuredProducts: z.object({
    type: z.literal('featuredProducts'),
    props: z.object({
      title: z.string().max(80),
      subtitle: z.string().max(200).optional(),
      source: z.enum(['featured', 'newest']).default('featured'),
      limit: z.number().int().min(1).max(24).default(8),
    }),
  }),
  promoBanner: z.object({
    type: z.literal('promoBanner'),
    props: z.object({
      bannerId: z.string(),
      eyebrow: z.string().max(60).optional(),
      heading: z.string().max(100),
      body: z.string().max(300).optional(),
      ctaLabel: z.string().max(40).optional(),
      ctaHref: href.optional(),
    }),
  }),
  brandStory: z.object({
    type: z.literal('brandStory'),
    props: z.object({
      eyebrow: z.string().max(60).optional(),
      heading: z.string().max(100),
      body: z.string().max(1200),
    }),
  }),
} as const;

export type SectionType = keyof typeof sectionSchemas;
export type Section = {
  [K in SectionType]: z.infer<(typeof sectionSchemas)[K]>;
}[SectionType];
export type SectionOf<K extends SectionType> = Extract<Section, { type: K }>;

export const themeConfigSchema = z.object({
  templateKey: z.string().min(1),
  tokens: themeTokensSchema,
  branding: brandingSchema.default({ logoKey: null, faviconKey: null }),
  /** Short line in the bar above the header, e.g. free shipping. */
  announcement: z.string().max(140).optional(),
  /** Parsed one by one in parseThemeConfig so a bad section is skipped. */
  sections: z.array(z.unknown()).default([]),
});

export type ThemeConfig = Omit<
  z.infer<typeof themeConfigSchema>,
  'sections'
> & {
  sections: Section[];
};

function isSectionType(value: unknown): value is SectionType {
  return typeof value === 'string' && value in sectionSchemas;
}

/** Parses one section; unknown types and invalid props return null. */
export function parseSection(raw: unknown): Section | null {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return null;
  if (!isSectionType(raw.type)) return null;
  const result = sectionSchemas[raw.type].safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Parses a stored theme config (a jsonb column). Throws if the tokens are
 * invalid, since the store cannot render without them; individual sections
 * that are unknown or invalid are dropped instead.
 */
export function parseThemeConfig(raw: Json): ThemeConfig {
  const base = themeConfigSchema.parse(raw);
  const sections = base.sections
    .map(parseSection)
    .filter((section): section is Section => section !== null);
  return { ...base, sections };
}
