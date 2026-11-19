import { describe, expect, it } from 'vitest';
import { mockDb } from '@/mocks';
import { parseSection, parseThemeConfig } from './schema';
import { contrastRatio, readableOn, tokensToCssVars } from './tokens';

const baseTheme = {
  templateKey: 'silk',
  tokens: {
    colors: {
      primary: '#7A1F2B',
      accent: '#C9A227',
      background: '#FBF8F3',
      text: '#1E1A16',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    radius: 'sm',
  },
};

describe('parseThemeConfig', () => {
  it('parses both mock store themes', () => {
    for (const row of mockDb.tenant_themes) {
      const theme = parseThemeConfig(row.published);
      expect(theme.templateKey).toBe('silk');
      expect(theme.sections.length).toBeGreaterThan(3);
    }
  });

  it('skips unknown and invalid sections but keeps valid ones', () => {
    const theme = parseThemeConfig({
      ...baseTheme,
      sections: [
        { type: 'testimonials', props: {} },
        { type: 'categoryTiles', props: { limit: 99 } },
        { type: 'brandStory', props: { heading: 'Hi', body: 'There' } },
        'not even an object',
      ],
    });
    expect(theme.sections.map((s) => s.type)).toEqual(['brandStory']);
  });

  it('fills section defaults', () => {
    expect(parseSection({ type: 'categoryTiles', props: {} })).toEqual({
      type: 'categoryTiles',
      props: { title: 'Shop by category', limit: 6 },
    });
  });

  it('rejects invalid tokens instead of rendering a broken store', () => {
    expect(() =>
      parseThemeConfig({
        ...baseTheme,
        tokens: {
          ...baseTheme.tokens,
          colors: { ...baseTheme.tokens.colors, primary: 'red' },
        },
      }),
    ).toThrow();
    expect(() =>
      parseThemeConfig({
        ...baseTheme,
        tokens: {
          ...baseTheme.tokens,
          fonts: { heading: 'Comic Sans', body: 'Inter' },
        },
      }),
    ).toThrow();
  });
});

describe('tokens', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks readable text for filled buttons', () => {
    expect(readableOn('#7A1F2B', ['#1E1A16', '#FBF8F3'])).toBe('#FBF8F3');
    expect(readableOn('#C9A227', ['#1E1A16', '#FBF8F3'])).toBe('#1E1A16');
  });

  it('maps tokens to CSS variables with readable on-colours', () => {
    const vars = tokensToCssVars({
      colors: baseTheme.tokens.colors,
      fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
      radius: 'lg',
    });
    expect(vars['--store-primary']).toBe('#7A1F2B');
    expect(vars['--store-radius']).toBe('18px');
    expect(
      contrastRatio(vars['--store-primary']!, vars['--store-on-primary']!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(vars['--store-accent']!, vars['--store-on-accent']!),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
