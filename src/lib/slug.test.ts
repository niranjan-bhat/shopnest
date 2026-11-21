import { describe, expect, it } from 'vitest';
import { SLUG_MAX, SLUG_PATTERN, slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Kanjivaram', 'kanjivaram'],
    ['Kurta Sets', 'kurta-sets'],
    ['  Silk & Zari  ', 'silk-and-zari'],
    ['Co-ords / Two-piece', 'co-ords-two-piece'],
    ['Crêpe Sarees', 'crepe-sarees'],
    ['Under ₹4,000', 'under-4-000'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it('returns an empty string for names in other scripts', () => {
    expect(slugify('साड़ी')).toBe('');
  });

  it('keeps slugs within the limit without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(99)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});
