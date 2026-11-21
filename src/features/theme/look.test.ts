import { describe, expect, it } from 'vitest';
import { colourWarnings, lookOf, sameTheme, withLook } from './look';
import type { ThemeConfig } from './schema';

const theme: ThemeConfig = {
  templateKey: 'silk',
  tokens: {
    colors: {
      primary: '#7A1F2B',
      accent: '#C9A227',
      background: '#FBF8F3',
      text: '#1E1A16',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    radius: 'none',
  },
  branding: { logoKey: null, faviconKey: null, tagline: 'Handwoven silks' },
  announcement: 'Free shipping',
  sections: [
    { type: 'brandStory', props: { heading: 'Our story', body: 'x' } },
  ],
};

describe('look', () => {
  it('round-trips a theme through the form', () => {
    expect(withLook(theme, lookOf(theme))).toEqual(theme);
  });

  it('keeps sections and template when the look changes', () => {
    const changed = withLook(theme, {
      ...lookOf(theme),
      headingFont: 'Lora',
      tagline: '',
      announcement: '',
    });
    expect(changed.tokens.fonts.heading).toBe('Lora');
    expect(changed.branding.tagline).toBeUndefined();
    expect(changed.announcement).toBeUndefined();
    expect(changed.sections).toBe(theme.sections);
    expect(changed.templateKey).toBe('silk');
  });

  it('tells a changed draft from the published theme', () => {
    expect(sameTheme(theme, structuredClone(theme))).toBe(true);
    expect(sameTheme(theme, null)).toBe(false);
    expect(
      sameTheme(withLook(theme, { ...lookOf(theme), radius: 'lg' }), theme),
    ).toBe(false);
  });
});

describe('colourWarnings', () => {
  it('accepts readable colours', () => {
    expect(colourWarnings(theme.tokens.colors)).toEqual([]);
  });

  it('warns about faint text and a faint brand colour', () => {
    const warnings = colourWarnings({
      ...theme.tokens.colors,
      text: '#B0AAA0',
      primary: '#F0E6D0',
    });
    expect(warnings.map((w) => w.field)).toEqual(['text', 'primary']);
  });
});
