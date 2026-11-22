import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from './defaults';
import type { Section } from './schema';
import {
  allowedSectionTypes,
  homeSectionsSchema,
  MAX_SECTIONS,
  newSection,
  sectionPropsSchemas,
  sectionsProblem,
} from './sections';

const BANNER = 'a6000000-0000-4000-8000-000000000001';
const OTHER = 'b6000000-0000-4000-8000-000000000001';

/** Sections shaped like the demo stores' themes. */
const demo: Section[] = [
  {
    type: 'hero',
    props: {
      eyebrow: 'Wedding season 2026',
      subheading: 'Kanjivaram and Banarasi silks.',
      ctaLabel: 'Explore the collection',
      ctaHref: '/c/kanjivaram',
      bannerIds: [BANNER],
    },
  },
  { type: 'categoryTiles', props: { title: 'Shop by weave', limit: 6 } },
  {
    type: 'featuredProducts',
    props: { title: 'Bridal & festive', source: 'featured', limit: 8 },
  },
  {
    type: 'promoBanner',
    props: {
      bannerId: BANNER,
      heading: 'Cottons under ₹4,000',
      ctaLabel: 'Shop cotton',
      ctaHref: '/c/cotton',
    },
  },
  {
    type: 'brandStory',
    props: { heading: 'Three generations', body: 'One loom in Kanchipuram.' },
  },
];

describe('homeSectionsSchema', () => {
  it('accepts stored themes as they are', () => {
    expect(homeSectionsSchema.parse(demo)).toEqual(demo);
    expect(homeSectionsSchema.parse(DEFAULT_THEME.sections)).toEqual(
      DEFAULT_THEME.sections,
    );
  });

  it('limits the number of sections', () => {
    const many = Array.from({ length: MAX_SECTIONS + 1 }, () => demo[4]);
    expect(homeSectionsSchema.safeParse(many).success).toBe(false);
  });

  it('names the section that is incomplete', () => {
    const result = homeSectionsSchema.safeParse([
      demo[0],
      { type: 'brandStory', props: { heading: 'Us', body: '' } },
    ]);
    expect(result.error?.issues[0]?.path).toEqual([1, 'props', 'body']);
  });

  it('rejects unknown section types', () => {
    const result = homeSectionsSchema.safeParse([
      { type: 'testimonials', props: {} },
    ]);
    expect(result.success).toBe(false);
  });
});

describe('section forms', () => {
  it('drops empty optional text and defaults the hero link', () => {
    const props = sectionPropsSchemas.hero.parse({
      eyebrow: '  ',
      subheading: '',
      ctaLabel: 'Shop now',
      ctaHref: '',
    });
    expect(props).toEqual({ ctaLabel: 'Shop now', ctaHref: '/' });
  });

  it('checks button links', () => {
    const bad = sectionPropsSchemas.hero.safeParse({
      ctaLabel: 'Shop',
      ctaHref: 'javascript:alert(1)',
    });
    expect(bad.error?.issues[0]?.path).toEqual(['ctaHref']);
  });

  it('needs at least one chosen hero banner, or all of them', () => {
    expect(
      sectionPropsSchemas.hero.safeParse({ ctaLabel: 'Shop', bannerIds: [] })
        .success,
    ).toBe(false);
    expect(
      sectionPropsSchemas.hero.safeParse({ ctaLabel: 'Shop' }).success,
    ).toBe(true);
  });

  it('wants promo button text and link together', () => {
    const base = { bannerId: BANNER, heading: 'Sale' };
    expect(
      sectionPropsSchemas.promoBanner.safeParse({ ...base, ctaLabel: 'Shop' })
        .error?.issues[0]?.path,
    ).toEqual(['ctaHref']);
    expect(
      sectionPropsSchemas.promoBanner.safeParse({ ...base, ctaHref: '/c/x' })
        .error?.issues[0]?.path,
    ).toEqual(['ctaLabel']);
    expect(sectionPropsSchemas.promoBanner.safeParse(base).success).toBe(true);
  });

  it('starts new sections with sensible values', () => {
    expect(
      homeSectionsSchema.safeParse([
        newSection('hero', null),
        newSection('categoryTiles', null),
        newSection('featuredProducts', null),
      ]).success,
    ).toBe(true);
    // These need the merchant's words (and a banner) first.
    expect(
      homeSectionsSchema.safeParse([newSection('promoBanner', BANNER)]).success,
    ).toBe(false);
    expect(
      homeSectionsSchema.safeParse([newSection('brandStory', null)]).success,
    ).toBe(false);
  });
});

describe('sectionsProblem', () => {
  const allowed = allowedSectionTypes([
    'hero',
    'categoryTiles',
    'featuredProducts',
    'promoBanner',
    'brandStory',
  ]);

  it('accepts the store’s own banners', () => {
    expect(sectionsProblem(demo, allowed, new Set([BANNER]))).toBeNull();
  });

  it('refuses another store’s banner', () => {
    expect(sectionsProblem(demo, allowed, new Set([OTHER]))).toMatch(
      /banner that no longer exists/,
    );
  });

  it('refuses types the store may not use', () => {
    expect(
      sectionsProblem(demo, ['hero', 'categoryTiles'], new Set([BANNER])),
    ).toMatch(/Product grid sections are not available/);
  });
});
