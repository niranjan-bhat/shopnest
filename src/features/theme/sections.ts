import { z } from 'zod';
import { isBannerLink } from './banners';
import type { Section, SectionType } from './schema';

// The home page sections editor. These schemas check what a merchant types
// (in the browser, then again in the save action). They accept a stored
// section as well as form values, and output clean section props: empty
// optional text is dropped.

export const MAX_SECTIONS = 12;

export const SECTION_INFO: Record<
  SectionType,
  { label: string; description: string }
> = {
  hero: {
    label: 'Hero',
    description: 'Large banner photos with a heading and a button.',
  },
  categoryTiles: {
    label: 'Category tiles',
    description: 'Your categories as photo tiles.',
  },
  featuredProducts: {
    label: 'Product grid',
    description: 'Featured or newest products.',
  },
  promoBanner: {
    label: 'Promo',
    description: 'One banner photo beside a short message.',
  },
  brandStory: {
    label: 'Brand story',
    description: 'A few lines about your brand.',
  },
};

/**
 * Section types this store may add. The one place to decide it: today every
 * type the template supports; plan limits can narrow it later.
 */
export function allowedSectionTypes(
  templateSections: readonly SectionType[],
): SectionType[] {
  return [...templateSections];
}

const tooLong = (max: number) => `Keep it under ${max} characters`;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
    .optional()
    .transform((v) => v || undefined);

const requiredText = (max: number, empty: string) =>
  z.string().trim().min(1, empty).max(max, tooLong(max));

const LINK_MESSAGE =
  'Use a store page such as /c/sarees, or a full address starting with https://';

const optionalLink = z
  .string()
  .trim()
  .max(300, tooLong(300))
  .refine((v) => v === '' || isBannerLink(v), LINK_MESSAGE)
  .optional()
  .transform((v) => v || undefined);

const count = (max: number) =>
  z.number({ error: 'Choose how many' }).int().min(1).max(max);

export const sectionPropsSchemas = {
  hero: z.object({
    /** Absent: every live banner, in library order. */
    bannerIds: z
      .array(z.uuid())
      .min(1, 'Choose at least one banner, or show all of them')
      .max(20)
      .optional(),
    eyebrow: optionalText(60),
    subheading: optionalText(200),
    ctaLabel: requiredText(40, 'Enter the button text'),
    ctaHref: optionalLink.transform((v) => v ?? '/'),
  }),
  categoryTiles: z.object({
    title: requiredText(80, 'Enter a title'),
    limit: count(12),
  }),
  featuredProducts: z.object({
    title: requiredText(80, 'Enter a title'),
    subtitle: optionalText(200),
    source: z.enum(['featured', 'newest']),
    limit: count(24),
  }),
  promoBanner: z
    .object({
      bannerId: z.uuid({ error: 'Choose a banner' }),
      eyebrow: optionalText(60),
      heading: requiredText(100, 'Enter a heading'),
      body: optionalText(300),
      ctaLabel: optionalText(40),
      ctaHref: optionalLink,
    })
    .refine((p) => !p.ctaLabel || p.ctaHref, {
      path: ['ctaHref'],
      message: 'Add where the button goes',
    })
    .refine((p) => !p.ctaHref || p.ctaLabel, {
      path: ['ctaLabel'],
      message: 'Add the button text',
    }),
  brandStory: z.object({
    eyebrow: optionalText(60),
    heading: requiredText(100, 'Enter a heading'),
    body: requiredText(1200, 'Write a few lines about your brand'),
  }),
} as const;

export type SectionProps<K extends SectionType> = z.output<
  (typeof sectionPropsSchemas)[K]
>;

const sectionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), props: sectionPropsSchemas.hero }),
  z.object({
    type: z.literal('categoryTiles'),
    props: sectionPropsSchemas.categoryTiles,
  }),
  z.object({
    type: z.literal('featuredProducts'),
    props: sectionPropsSchemas.featuredProducts,
  }),
  z.object({
    type: z.literal('promoBanner'),
    props: sectionPropsSchemas.promoBanner,
  }),
  z.object({
    type: z.literal('brandStory'),
    props: sectionPropsSchemas.brandStory,
  }),
]);

/** The whole list the editor saves. */
export const homeSectionsSchema = z
  .array(sectionSchema)
  .max(MAX_SECTIONS, `A home page can have up to ${MAX_SECTIONS} sections`);

/** Props for a section just added, before the merchant edits them. */
export function newSection(
  type: SectionType,
  firstBannerId: string | null,
): Section {
  switch (type) {
    case 'hero':
      return { type, props: { ctaLabel: 'Shop now', ctaHref: '/' } };
    case 'categoryTiles':
      return { type, props: { title: 'Shop by category', limit: 6 } };
    case 'featuredProducts':
      return {
        type,
        props: { title: 'New arrivals', source: 'newest', limit: 8 },
      };
    case 'promoBanner':
      return {
        type,
        props: { bannerId: firstBannerId ?? '', heading: '' },
      };
    case 'brandStory':
      return { type, props: { heading: 'Our story', body: '' } };
  }
}

/** Banners a section names. */
export function sectionBannerIds(section: Section): string[] {
  if (section.type === 'hero') return section.props.bannerIds ?? [];
  if (section.type === 'promoBanner') return [section.props.bannerId];
  return [];
}

/**
 * Why a list cannot be saved for this store, or null: a type it may not
 * use, or a banner that is not one of its own.
 */
export function sectionsProblem(
  sections: Section[],
  allowed: readonly SectionType[],
  storeBannerIds: ReadonlySet<string>,
): string | null {
  for (const section of sections) {
    if (!allowed.includes(section.type)) {
      return `${SECTION_INFO[section.type].label} sections are not available for this store.`;
    }
    if (sectionBannerIds(section).some((id) => !storeBannerIds.has(id))) {
      return 'A section uses a banner that no longer exists. Choose another.';
    }
  }
  return null;
}
