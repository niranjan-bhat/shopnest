import { describe, expect, it } from 'vitest';
import {
  isPageSlug,
  PAGE_SLUGS,
  pageFormSchema,
  placeholdersIn,
  SAMPLE_PAGES,
  toBlocks,
} from './content';

describe('toBlocks', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(toBlocks('First line\nstill first.\n\n\nSecond.')).toEqual([
      { type: 'paragraph', text: 'First line still first.' },
      { type: 'paragraph', text: 'Second.' },
    ]);
  });

  it('turns "- " and "• " lines into one list', () => {
    expect(toBlocks('Rules:\n- One\n• Two\n\nAfter.')).toEqual([
      { type: 'paragraph', text: 'Rules:' },
      { type: 'list', items: ['One', 'Two'] },
      { type: 'paragraph', text: 'After.' },
    ]);
  });

  it('handles Windows line breaks and empty text', () => {
    expect(toBlocks('A\r\n\r\nB')).toHaveLength(2);
    expect(toBlocks('   \n\n ')).toEqual([]);
  });

  it('keeps markup as plain text', () => {
    expect(toBlocks('<script>alert(1)</script>')).toEqual([
      { type: 'paragraph', text: '<script>alert(1)</script>' },
    ]);
  });
});

describe('pageFormSchema', () => {
  it('will not show an empty page in the store', () => {
    const result = pageFormSchema.safeParse({
      title: 'Shipping',
      body: '  ',
      isPublished: true,
    });
    expect(result.error?.issues[0]?.path).toEqual(['body']);
    expect(
      pageFormSchema.safeParse({
        title: 'Shipping',
        body: '',
        isPublished: false,
      }).success,
    ).toBe(true);
  });

  it('needs a title', () => {
    const result = pageFormSchema.safeParse({
      title: '',
      body: 'x',
      isPublished: false,
    });
    expect(result.error?.issues[0]?.path).toEqual(['title']);
  });
});

describe('samples', () => {
  it.each(PAGE_SLUGS)('the %s sample has text and parts to fill in', (slug) => {
    expect(toBlocks(SAMPLE_PAGES[slug]).length).toBeGreaterThan(1);
    expect(placeholdersIn(SAMPLE_PAGES[slug]).length).toBeGreaterThan(0);
  });

  it('lists each placeholder once', () => {
    expect(placeholdersIn('[city] and [city], [7 days]')).toEqual([
      '[city]',
      '[7 days]',
    ]);
    expect(placeholdersIn('No brackets here')).toEqual([]);
  });

  it('knows the page slugs', () => {
    expect(isPageSlug('shipping')).toBe(true);
    expect(isPageSlug('faq')).toBe(false);
  });
});
