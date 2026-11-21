import { describe, expect, it } from 'vitest';
import {
  categoryFormSchema,
  categoryOrderSchema,
  categorySlug,
} from './schemas';

describe('categoryFormSchema', () => {
  it('trims the name and normalises the slug', () => {
    expect(
      categoryFormSchema.parse({
        name: '  Kurta Sets ',
        slug: ' Kurta-Sets ',
        isActive: true,
        showInMenu: true,
      }),
    ).toEqual({
      name: 'Kurta Sets',
      slug: 'kurta-sets',
      isActive: true,
      showInMenu: true,
    });
  });

  it('requires a name', () => {
    const result = categoryFormSchema.safeParse({
      name: '   ',
      slug: '',
      isActive: true,
      showInMenu: false,
    });
    expect(result.success).toBe(false);
  });

  it.each(['kurta sets', 'kurta--sets', '-kurta', 'कुर्ता'])(
    'rejects the slug %s',
    (slug) => {
      const result = categoryFormSchema.safeParse({
        name: 'Kurta',
        slug,
        isActive: true,
        showInMenu: false,
      });
      expect(result.success).toBe(false);
    },
  );
});

describe('categoryFormSchema menu flag', () => {
  it('requires an explicit choice for the top menu', () => {
    const base = { name: 'Kurta', slug: '', isActive: true };
    expect(categoryFormSchema.safeParse(base).success).toBe(false);
    expect(
      categoryFormSchema.safeParse({ ...base, showInMenu: false }).success,
    ).toBe(true);
  });
});

describe('categorySlug', () => {
  it('uses the typed slug, or makes one from the name', () => {
    expect(
      categorySlug({
        name: 'Kurta Sets',
        slug: 'kurtas',
        isActive: true,
        showInMenu: false,
      }),
    ).toBe('kurtas');
    expect(
      categorySlug({
        name: 'Kurta Sets',
        slug: '',
        isActive: true,
        showInMenu: false,
      }),
    ).toBe('kurta-sets');
  });

  it('is empty for a name in another script with no slug typed', () => {
    expect(
      categorySlug({
        name: 'साड़ी',
        slug: '',
        isActive: true,
        showInMenu: false,
      }),
    ).toBe('');
  });
});

describe('categoryOrderSchema', () => {
  const a = '00000001-0000-4000-8000-000000000001';
  const b = '00000001-0000-4000-8000-000000000002';

  it('accepts distinct ids', () => {
    expect(categoryOrderSchema.safeParse([a, b]).success).toBe(true);
  });

  it('rejects duplicates and non-ids', () => {
    expect(categoryOrderSchema.safeParse([a, a]).success).toBe(false);
    expect(categoryOrderSchema.safeParse(['nope']).success).toBe(false);
  });
});
