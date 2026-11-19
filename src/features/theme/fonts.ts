import {
  Cormorant_Garamond,
  DM_Sans,
  Inter,
  Lora,
  Marcellus,
  Playfair_Display,
} from 'next/font/google';
import type { FontName } from './schema';

// next/font needs every font declared at module scope with literal options
// (no shared objects or spreads), so the whole whitelist lives here.
// `preload: false` because a store only uses two of these; the browser
// downloads just the faces its text actually uses.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-playfair',
});
const marcellus = Marcellus({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: '400',
  variable: '--font-marcellus',
});
const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-lora',
});
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-inter',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-dm-sans',
});

const FONTS: Record<FontName, { variable: string; cssVar: string }> = {
  'Cormorant Garamond': {
    variable: cormorant.variable,
    cssVar: '--font-cormorant',
  },
  'Playfair Display': {
    variable: playfair.variable,
    cssVar: '--font-playfair',
  },
  Marcellus: { variable: marcellus.variable, cssVar: '--font-marcellus' },
  Lora: { variable: lora.variable, cssVar: '--font-lora' },
  Inter: { variable: inter.variable, cssVar: '--font-inter' },
  'DM Sans': { variable: dmSans.variable, cssVar: '--font-dm-sans' },
};

/**
 * Class names and CSS variables that apply a store's heading and body fonts.
 * Templates use them through the `font-store-heading` / `font-store-body`
 * Tailwind utilities.
 */
export function storeFonts(fonts: { heading: FontName; body: FontName }): {
  className: string;
  style: Record<'--store-font-heading' | '--store-font-body', string>;
} {
  const heading = FONTS[fonts.heading];
  const body = FONTS[fonts.body];
  return {
    className: [...new Set([heading.variable, body.variable])].join(' '),
    style: {
      '--store-font-heading': `var(${heading.cssVar})`,
      '--store-font-body': `var(${body.cssVar})`,
    },
  };
}
