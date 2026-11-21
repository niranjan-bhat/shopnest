import type { ThemeConfig } from './schema';

/**
 * Starting theme for a store that has none yet: calm neutrals, a serif
 * heading, and a home page that works with any catalog (banners, category
 * tiles, newest products). Merchants restyle it in the storefront editor.
 */
export const DEFAULT_THEME: ThemeConfig = {
  templateKey: 'silk',
  tokens: {
    colors: {
      primary: '#6B2D3C',
      accent: '#B8892E',
      background: '#FAF7F2',
      text: '#1F1B17',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    radius: 'sm',
  },
  branding: { logoKey: null, faviconKey: null },
  sections: [
    {
      type: 'hero',
      props: { ctaLabel: 'Shop now', ctaHref: '/' },
    },
    {
      type: 'categoryTiles',
      props: { title: 'Shop by category', limit: 6 },
    },
    {
      type: 'featuredProducts',
      props: { title: 'New arrivals', source: 'newest', limit: 8 },
    },
  ],
};
