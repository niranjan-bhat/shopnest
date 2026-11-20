// Phase 1 mock stores. Plain data with no runtime imports, so both the app
// (through src/mocks/index.ts, which turns it into typed table rows) and
// scripts/generate-mock-media.mjs (run directly by Node) can load it.
//
// The WhatsApp numbers are placeholders. Put your own number in `whatsapp`
// to try the checkout end to end.

export type FixtureVariant = {
  options: Record<string, string>;
  stock: number;
  /** Paise; overrides the product price for this variant. */
  price?: number;
};

export type FixtureProduct = {
  slug: string;
  name: string;
  categories: string[];
  /** Paise, or null when the price is on request. */
  price: number | null;
  compareAt?: number;
  description: string;
  attributes: Record<string, string>;
  featured?: boolean;
  status?: 'draft' | 'active' | 'archived';
  /** How many days ago it was added; drives "newest" sorting. */
  ageDays: number;
  /** Number of photos in photos/<n>/ for the n-th product. */
  images: number;
  /** Defaults to one variant with 6 in stock. */
  variants?: FixtureVariant[];
};

export type FixtureCategory = { slug: string; name: string };

export type FixtureBanner = {
  heading: string;
  link: string;
  /** Hero banners are wide; promo banners are closer to square. */
  shape: 'hero' | 'promo';
};

export type FixtureStore = {
  n: number;
  slug: string;
  name: string;
  hostname: string;
  whatsapp: string;
  businessType: string;
  /** Stored as tenant_themes.published; validated by parseThemeConfig. */
  theme: Record<string, unknown> & {
    tokens: Record<string, unknown> & {
      colors: Record<'primary' | 'accent' | 'background' | 'text', string>;
    };
  };
  categories: FixtureCategory[];
  products: FixtureProduct[];
  banners: FixtureBanner[];
};

// ---------------------------------------------------------------------------
// IDs and R2 object keys (shared by the app and the image script)
// ---------------------------------------------------------------------------

export const ID_KIND = {
  tenant: 0,
  domain: 1,
  category: 2,
  product: 3,
  variant: 4,
  image: 5,
  banner: 6,
} as const;

const hex = (value: number, width: number) =>
  value.toString(16).padStart(width, '0');

/** Deterministic UUID-shaped id, so keys and links are stable across runs. */
export function fixtureId(
  store: number,
  kind: keyof typeof ID_KIND,
  index: number,
): string {
  return `${hex(store, 8)}-${hex(ID_KIND[kind], 4)}-4000-8000-${hex(index, 12)}`;
}

export const mediaKey = {
  product: (tenantId: string, productId: string, n: number) =>
    `tenants/${tenantId}/products/${productId}/${n}.webp`,
  category: (tenantId: string, categoryId: string) =>
    `tenants/${tenantId}/categories/${categoryId}.webp`,
  banner: (tenantId: string, bannerId: string) =>
    `tenants/${tenantId}/banners/${bannerId}.webp`,
};

/** Image sizes in pixels, by use. */
export const MEDIA_SIZE = {
  product: { width: 900, height: 1200 },
  category: { width: 800, height: 800 },
  hero: { width: 1920, height: 960 },
  promo: { width: 1200, height: 900 },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rupees to paise. */
const rs = (rupees: number) => rupees * 100;

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;

/** One variant per size, with the given stock for each. */
const sized = (stock: [number, number, number, number, number], extra = {}) =>
  SIZES.map((size, i) => ({
    options: { ...extra, size },
    stock: stock[i],
  }));

const SAREE_CARE = 'Dry clean only';
const SAREE_LENGTH = '5.5 m saree + 0.8 m blouse piece';

// ---------------------------------------------------------------------------
// Store 1: saree shop
// ---------------------------------------------------------------------------

const sareeStore: FixtureStore = {
  n: 1,
  slug: 'saree-demo',
  name: 'Tara Weaves',
  hostname: 'saree-demo.localhost',
  whatsapp: '+910000000001',
  businessType: 'saree',
  theme: {
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
    branding: {
      logoKey: null,
      faviconKey: null,
      tagline: 'Handwoven silks from Kanchipuram and Varanasi',
    },
    announcement: 'Free shipping across India on orders above ₹5,000',
    sections: [
      {
        type: 'hero',
        props: {
          eyebrow: 'Wedding season 2026',
          subheading:
            'Kanjivaram and Banarasi silks, woven by master weavers and finished by hand.',
          ctaLabel: 'Explore the collection',
          ctaHref: '/c/kanjivaram',
          bannerIds: [fixtureId(1, 'banner', 1), fixtureId(1, 'banner', 2)],
        },
      },
      { type: 'categoryTiles', props: { title: 'Shop by weave', limit: 6 } },
      {
        type: 'featuredProducts',
        props: {
          title: 'Bridal & festive',
          subtitle: 'Heirloom silks for the days you will remember.',
          source: 'featured',
          limit: 8,
        },
      },
      {
        type: 'promoBanner',
        props: {
          bannerId: fixtureId(1, 'banner', 3),
          eyebrow: 'Everyday handloom',
          heading: 'Cottons and linens under ₹4,000',
          body: 'Breathable weaves from Chettinad, Mangalagiri and Bengal, made for long summer days.',
          ctaLabel: 'Shop cotton',
          ctaHref: '/c/cotton',
        },
      },
      {
        type: 'featuredProducts',
        props: { title: 'New on the loom', source: 'newest', limit: 4 },
      },
      {
        type: 'brandStory',
        props: {
          eyebrow: 'Our story',
          heading: 'Three generations of weaving',
          body: 'Tara Weaves began as a single loom in Kanchipuram. Today we work with forty weaving families, paying fair wages and keeping traditional techniques like korvai and temple borders alive. Every saree is checked by hand before it reaches you.',
        },
      },
      // Deliberately unknown section type: proves the renderer skips it.
      { type: 'testimonials', props: {} },
    ],
  },
  categories: [
    { slug: 'kanjivaram', name: 'Kanjivaram' },
    { slug: 'banarasi', name: 'Banarasi' },
    { slug: 'soft-silk', name: 'Soft Silk' },
    { slug: 'cotton', name: 'Cotton' },
    { slug: 'linen', name: 'Linen' },
    { slug: 'organza', name: 'Organza' },
  ],
  banners: [
    {
      heading: 'Woven for the wedding season',
      link: '/c/kanjivaram',
      shape: 'hero',
    },
    {
      heading: 'The Banarasi edit',
      link: '/c/banarasi',
      shape: 'hero',
    },
    {
      heading: 'Everyday handloom',
      link: '/c/cotton',
      shape: 'promo',
    },
  ],
  products: [
    {
      slug: 'ruby-temple-border-kanjivaram',
      name: 'Ruby Temple-Border Kanjivaram',
      categories: ['kanjivaram'],
      price: rs(24500),
      description:
        'A classic ruby Kanjivaram with a contrast temple border and a rich pallu of peacocks and mango motifs, woven in pure mulberry silk.',
      attributes: {
        fabric: 'Pure mulberry silk',
        zari: 'Silver zari, gold polished',
        colour: 'Red',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Wedding',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 40,
      images: 5,
      variants: [{ options: {}, stock: 4 }],
    },
    {
      slug: 'bridal-peacock-kanjivaram',
      name: 'Bridal Peacock Kanjivaram',
      categories: ['kanjivaram'],
      price: null,
      description:
        'Our heaviest bridal weave: an emerald body with an all-over peacock jaal and a 9-inch korvai border. Made to order; price confirmed on WhatsApp.',
      attributes: {
        fabric: 'Pure mulberry silk',
        zari: 'Pure gold zari',
        colour: 'Green',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Bridal',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 5,
      images: 3,
      variants: [{ options: {}, stock: 1 }],
    },
    {
      slug: 'mustard-korvai-kanjivaram',
      name: 'Mustard Korvai Kanjivaram',
      categories: ['kanjivaram'],
      price: rs(18900),
      compareAt: rs(21000),
      description:
        'Turmeric-gold body with an interlocked korvai border in deep maroon. Light enough to wear all day.',
      attributes: {
        fabric: 'Pure mulberry silk',
        zari: 'Silver zari, gold polished',
        colour: 'Yellow',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Festive',
        care: SAREE_CARE,
      },
      ageDays: 60,
      images: 3,
    },
    {
      slug: 'midnight-brocade-banarasi',
      name: 'Midnight Brocade Banarasi',
      categories: ['banarasi'],
      price: rs(15400),
      description:
        'Midnight-blue katan silk with a dense floral brocade and a shimmering kadhwa pallu.',
      attributes: {
        fabric: 'Katan silk',
        zari: 'Antique gold zari',
        colour: 'Blue',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Festive',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 12,
      images: 4,
    },
    {
      slug: 'rose-kadhwa-banarasi',
      name: 'Rose Kadhwa Banarasi',
      categories: ['banarasi'],
      price: rs(12800),
      description:
        'Soft rose georgette woven with kadhwa buttis, finished with a scalloped zari border.',
      attributes: {
        fabric: 'Georgette',
        zari: 'Silver zari',
        colour: 'Pink',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Party',
        care: SAREE_CARE,
      },
      ageDays: 25,
      images: 4,
    },
    {
      slug: 'ivory-tissue-banarasi',
      name: 'Ivory Tissue Banarasi',
      categories: ['banarasi'],
      price: null,
      description:
        'An heirloom ivory tissue saree with real gold zari. Woven to order in about six weeks; price confirmed on WhatsApp.',
      attributes: {
        fabric: 'Tissue silk',
        zari: 'Pure gold zari',
        colour: 'Ivory',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Bridal',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 3,
      images: 4,
      variants: [{ options: {}, stock: 2 }],
    },
    {
      slug: 'lavender-soft-silk',
      name: 'Lavender Soft Silk',
      categories: ['soft-silk'],
      price: rs(7450),
      description:
        'A featherlight soft silk in lavender with a slim gold border, easy to drape and easy to carry.',
      attributes: {
        fabric: 'Soft silk',
        zari: 'Copper zari',
        colour: 'Purple',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Festive',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 8,
      images: 4,
    },
    {
      slug: 'teal-zari-butta-soft-silk',
      name: 'Teal Zari-Butta Soft Silk',
      categories: ['soft-silk'],
      price: rs(6900),
      compareAt: rs(7900),
      description:
        'Deep teal soft silk scattered with tiny zari buttas and a contrast magenta border.',
      attributes: {
        fabric: 'Soft silk',
        zari: 'Copper zari',
        colour: 'Teal',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Festive',
        care: SAREE_CARE,
      },
      ageDays: 30,
      images: 4,
    },
    {
      slug: 'coral-soft-silk',
      name: 'Coral Soft Silk',
      categories: ['soft-silk'],
      price: rs(6200),
      description:
        'A bright coral soft silk with a plain body and a woven pallu. Restocking soon.',
      attributes: {
        fabric: 'Soft silk',
        zari: 'Copper zari',
        colour: 'Orange',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Party',
        care: SAREE_CARE,
      },
      ageDays: 50,
      images: 4,
      variants: [{ options: {}, stock: 0 }],
    },
    {
      slug: 'indigo-kalamkari-cotton',
      name: 'Indigo Kalamkari Cotton',
      categories: ['cotton'],
      price: rs(2450),
      description:
        'Hand-painted kalamkari on soft mul cotton, dyed in natural indigo.',
      attributes: {
        fabric: 'Mul cotton',
        colour: 'Blue',
        length: SAREE_LENGTH,
        blouse: 'Not included',
        occasion: 'Everyday',
        care: 'Hand wash cold, separately',
      },
      featured: true,
      ageDays: 2,
      images: 3,
      variants: [{ options: {}, stock: 12 }],
    },
    {
      slug: 'chettinad-checks-cotton',
      name: 'Chettinad Checks Cotton',
      categories: ['cotton'],
      price: rs(1890),
      description:
        'Bold Chettinad checks in rust and mustard, with a crisp hand that softens with every wash.',
      attributes: {
        fabric: 'Chettinad cotton',
        colour: 'Orange',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Everyday',
        care: 'Hand wash cold, separately',
      },
      ageDays: 18,
      images: 4,
      variants: [{ options: {}, stock: 9 }],
    },
    {
      slug: 'sage-mangalagiri-cotton',
      name: 'Sage Mangalagiri Cotton',
      categories: ['cotton'],
      price: rs(2150),
      description:
        'Sage-green Mangalagiri cotton with a nizam zari border; a workday favourite.',
      attributes: {
        fabric: 'Mangalagiri cotton',
        colour: 'Green',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Everyday',
        care: 'Hand wash cold, separately',
      },
      ageDays: 35,
      images: 4,
    },
    {
      slug: 'natural-handloom-linen',
      name: 'Natural Handloom Linen',
      categories: ['linen'],
      price: rs(3650),
      description:
        'Undyed handloom linen with a fine silver zari border. Cool, crisp and quietly elegant.',
      attributes: {
        fabric: 'Linen',
        colour: 'Natural',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Office',
        care: 'Dry clean recommended',
      },
      ageDays: 6,
      images: 4,
    },
    {
      slug: 'charcoal-linen-silver-border',
      name: 'Charcoal Linen with Silver Border',
      categories: ['linen'],
      price: rs(3990),
      description:
        'Charcoal linen with a broad silver border. Only a few left from this weave.',
      attributes: {
        fabric: 'Linen',
        colour: 'Grey',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Office',
        care: 'Dry clean recommended',
      },
      ageDays: 22,
      images: 4,
      variants: [{ options: {}, stock: 2 }],
    },
    {
      slug: 'blush-floral-organza',
      name: 'Blush Floral Organza',
      categories: ['organza'],
      price: rs(4850),
      description:
        'Sheer blush organza with hand-embroidered florals and a delicate scalloped edge.',
      attributes: {
        fabric: 'Silk organza',
        colour: 'Pink',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Party',
        care: SAREE_CARE,
      },
      featured: true,
      ageDays: 1,
      images: 4,
    },
    {
      slug: 'sky-embroidered-organza',
      name: 'Sky Blue Embroidered Organza',
      categories: ['organza'],
      price: rs(5400),
      compareAt: rs(6200),
      description:
        'Powder-blue organza with tonal thread embroidery and a satin-finished border.',
      attributes: {
        fabric: 'Silk organza',
        colour: 'Blue',
        length: SAREE_LENGTH,
        blouse: 'Included, unstitched',
        occasion: 'Party',
        care: SAREE_CARE,
      },
      ageDays: 15,
      images: 4,
    },
    {
      slug: 'unreleased-paithani',
      name: 'Paithani (coming soon)',
      categories: ['kanjivaram'],
      price: rs(32000),
      description: 'Draft product: must never appear on the storefront.',
      attributes: { fabric: 'Silk', colour: 'Green' },
      status: 'draft',
      ageDays: 0,
      images: 4,
    },
  ],
};

// ---------------------------------------------------------------------------
// Store 2: women's ethnic-wear boutique
// ---------------------------------------------------------------------------

const KURTA_CARE = 'Gentle hand wash, dry in shade';

const boutiqueStore: FixtureStore = {
  n: 2,
  slug: 'boutique-demo',
  name: 'Noor Atelier',
  hostname: 'boutique-demo.localhost',
  whatsapp: '+910000000002',
  businessType: 'ethnic-wear',
  theme: {
    templateKey: 'silk',
    tokens: {
      colors: {
        primary: '#2F4A3A',
        accent: '#D98E73',
        background: '#F6F1EB',
        text: '#22302A',
      },
      fonts: { heading: 'Playfair Display', body: 'DM Sans' },
      radius: 'lg',
    },
    branding: {
      logoKey: null,
      faviconKey: null,
      tagline: 'Modern ethnic wear, made in small batches in Jaipur',
    },
    announcement: 'New festive edit is live · Easy 7-day exchanges',
    sections: [
      {
        type: 'hero',
        props: {
          eyebrow: 'Festive edit 2026',
          subheading:
            'Hand-finished kurta sets, anarkalis and lehengas in colours made for celebrating.',
          ctaLabel: 'Shop the edit',
          ctaHref: '/c/kurta-sets',
          bannerIds: [fixtureId(2, 'banner', 1), fixtureId(2, 'banner', 2)],
        },
      },
      {
        type: 'featuredProducts',
        props: {
          title: 'Just in',
          subtitle: 'Fresh from our Jaipur studio this week.',
          source: 'newest',
          limit: 4,
        },
      },
      { type: 'categoryTiles', props: { title: 'Find your fit', limit: 5 } },
      {
        type: 'brandStory',
        props: {
          eyebrow: 'Made slowly',
          heading: 'Small batches, real craft',
          body: 'Every Noor piece is cut and stitched in our Jaipur studio, with block prints, gota patti and chikankari done by artisans we have worked with for years. We make in small batches, so there is less waste and more care in every seam.',
        },
      },
      {
        type: 'promoBanner',
        props: {
          bannerId: fixtureId(2, 'banner', 3),
          eyebrow: 'Everyday ease',
          heading: 'Co-ords you will live in',
          body: 'Breathable cottons and linens, cut relaxed for work, travel and weekends.',
          ctaLabel: 'Shop co-ords',
          ctaHref: '/c/co-ords',
        },
      },
      {
        type: 'featuredProducts',
        props: { title: 'Bestsellers', source: 'featured', limit: 8 },
      },
    ],
  },
  categories: [
    { slug: 'kurta-sets', name: 'Kurta Sets' },
    { slug: 'anarkalis', name: 'Anarkalis' },
    { slug: 'lehengas', name: 'Lehengas' },
    { slug: 'co-ords', name: 'Co-ords' },
    { slug: 'dupattas', name: 'Dupattas' },
  ],
  banners: [
    {
      heading: 'The Noor festive edit',
      link: '/c/kurta-sets',
      shape: 'hero',
    },
    {
      heading: 'Lehengas, made to twirl',
      link: '/c/lehengas',
      shape: 'hero',
    },
    {
      heading: 'Co-ords for every day',
      link: '/c/co-ords',
      shape: 'promo',
    },
  ],
  products: [
    {
      slug: 'sage-chanderi-kurta-set',
      name: 'Sage Chanderi Kurta Set',
      categories: ['kurta-sets'],
      price: rs(4290),
      description:
        'A straight Chanderi kurta in sage with delicate gota detailing, paired with cotton pants and a sheer dupatta.',
      attributes: {
        fabric: 'Chanderi silk-cotton',
        colour: 'Green',
        fit: 'Straight, relaxed',
        length: 'Calf length',
        includes: 'Kurta, pants, dupatta',
        care: KURTA_CARE,
      },
      featured: true,
      ageDays: 4,
      images: 5,
      variants: sized([3, 5, 0, 4, 2]),
    },
    {
      slug: 'ivory-chikankari-kurta-set',
      name: 'Ivory Chikankari Kurta Set',
      categories: ['kurta-sets'],
      price: rs(5890),
      compareAt: rs(6990),
      description:
        'Hand-embroidered Lucknowi chikankari on soft mul, with a scalloped hem and matching palazzos.',
      attributes: {
        fabric: 'Mul cotton',
        colour: 'Ivory',
        fit: 'A-line',
        length: 'Knee length',
        includes: 'Kurta, palazzo',
        care: KURTA_CARE,
      },
      featured: true,
      ageDays: 20,
      images: 3,
      variants: sized([2, 4, 6, 3, 1]),
    },
    {
      slug: 'terracotta-block-print-kurta-set',
      name: 'Terracotta Block-Print Kurta Set',
      categories: ['kurta-sets'],
      price: rs(3450),
      description:
        'Hand block-printed in Sanganer with natural dyes, finished with wooden buttons.',
      attributes: {
        fabric: 'Cotton cambric',
        colour: 'Orange',
        fit: 'Straight',
        length: 'Calf length',
        includes: 'Kurta, pants',
        care: KURTA_CARE,
      },
      ageDays: 33,
      images: 3,
      variants: sized([4, 6, 6, 5, 3]),
    },
    {
      slug: 'midnight-velvet-anarkali',
      name: 'Midnight Velvet Anarkali',
      categories: ['anarkalis'],
      price: rs(8900),
      description:
        'A floor-length micro-velvet anarkali with zardozi at the yoke. Made for winter weddings.',
      attributes: {
        fabric: 'Micro velvet',
        colour: 'Blue',
        fit: 'Flared',
        length: 'Floor length',
        includes: 'Anarkali, churidar, dupatta',
        care: 'Dry clean only',
      },
      featured: true,
      ageDays: 10,
      images: 4,
      variants: sized([1, 2, 3, 2, 1]),
    },
    {
      slug: 'blush-tiered-anarkali',
      name: 'Blush Tiered Anarkali',
      categories: ['anarkalis'],
      price: rs(7250),
      description:
        'Three soft tiers of georgette in blush pink, with a hand-embroidered neckline.',
      attributes: {
        fabric: 'Georgette',
        colour: 'Pink',
        fit: 'Flared',
        length: 'Ankle length',
        includes: 'Anarkali, pants, dupatta',
        care: 'Dry clean only',
      },
      ageDays: 28,
      images: 4,
      variants: sized([2, 3, 4, 2, 0]),
    },
    {
      slug: 'emerald-georgette-anarkali',
      name: 'Emerald Georgette Anarkali',
      categories: ['anarkalis'],
      price: rs(6800),
      compareAt: rs(7900),
      description:
        'Emerald georgette with a sequinned yoke and a sweeping 4-metre flare.',
      attributes: {
        fabric: 'Georgette',
        colour: 'Green',
        fit: 'Flared',
        length: 'Floor length',
        includes: 'Anarkali, dupatta',
        care: 'Dry clean only',
      },
      ageDays: 45,
      images: 4,
      variants: sized([2, 2, 3, 3, 1]),
    },
    {
      slug: 'champagne-sequin-lehenga',
      name: 'Champagne Sequin Lehenga',
      categories: ['lehengas'],
      price: null,
      description:
        'Our signature bridal lehenga, covered in hand-placed sequins. Made to measure; price confirmed on WhatsApp.',
      attributes: {
        fabric: 'Net with silk lining',
        colour: 'Gold',
        fit: 'Made to measure',
        includes: 'Lehenga, blouse, dupatta',
        care: 'Dry clean only',
      },
      featured: true,
      ageDays: 6,
      images: 4,
      variants: sized([1, 1, 1, 1, 1]),
    },
    {
      slug: 'rani-pink-lehenga',
      name: 'Rani Pink Lehenga',
      categories: ['lehengas'],
      price: rs(24900),
      description:
        'Rani pink raw silk with gota patti borders and a mirror-work blouse.',
      attributes: {
        fabric: 'Raw silk',
        colour: 'Pink',
        fit: 'Flared',
        includes: 'Lehenga, blouse, dupatta',
        care: 'Dry clean only',
      },
      ageDays: 14,
      images: 4,
      variants: sized([1, 2, 2, 1, 1]),
    },
    {
      slug: 'pastel-mint-lehenga',
      name: 'Pastel Mint Lehenga',
      categories: ['lehengas'],
      price: rs(18500),
      description:
        'A light organza lehenga in mint with tonal thread work, made for day functions.',
      attributes: {
        fabric: 'Organza',
        colour: 'Green',
        fit: 'Flared',
        includes: 'Lehenga, blouse, dupatta',
        care: 'Dry clean only',
      },
      ageDays: 38,
      images: 4,
      variants: sized([1, 2, 2, 2, 0]),
    },
    {
      slug: 'ikat-co-ord',
      name: 'Ikat Co-ord Set',
      categories: ['co-ords'],
      price: rs(3990),
      description:
        'A boxy shirt and wide-leg pants in handwoven Pochampally ikat. Choose indigo or rust.',
      attributes: {
        fabric: 'Handwoven cotton ikat',
        colour: 'Blue',
        fit: 'Relaxed',
        includes: 'Shirt, pants',
        care: KURTA_CARE,
      },
      featured: true,
      ageDays: 3,
      images: 3,
      variants: [
        ...sized([2, 4, 5, 3, 1], { colour: 'Indigo' }),
        ...sized([1, 3, 3, 2, 0], { colour: 'Rust' }),
      ],
    },
    {
      slug: 'linen-lounge-co-ord',
      name: 'Linen Lounge Co-ord',
      categories: ['co-ords'],
      price: rs(3290),
      description:
        'Washed linen in oat, with a relaxed kurta-shirt and drawstring pants.',
      attributes: {
        fabric: 'Washed linen',
        colour: 'Natural',
        fit: 'Relaxed',
        includes: 'Top, pants',
        care: 'Machine wash gentle',
      },
      ageDays: 12,
      images: 4,
      variants: sized([3, 5, 5, 4, 2]),
    },
    {
      slug: 'olive-utility-co-ord',
      name: 'Olive Utility Co-ord',
      categories: ['co-ords'],
      price: rs(3650),
      description:
        'Cotton twill in olive, with patch pockets and a tie belt. Made for travel.',
      attributes: {
        fabric: 'Cotton twill',
        colour: 'Green',
        fit: 'Relaxed',
        includes: 'Shirt, pants',
        care: 'Machine wash gentle',
      },
      ageDays: 52,
      images: 4,
      variants: sized([2, 3, 3, 3, 2]),
    },
    {
      slug: 'mulmul-printed-co-ord',
      name: 'Mulmul Printed Co-ord',
      categories: ['co-ords'],
      price: rs(2890),
      description:
        'Featherlight mulmul with a peach floral print. Our coolest set for summer.',
      attributes: {
        fabric: 'Mulmul cotton',
        colour: 'Orange',
        fit: 'Relaxed',
        includes: 'Top, pants',
        care: KURTA_CARE,
      },
      ageDays: 24,
      images: 4,
      variants: sized([4, 6, 6, 4, 3]),
    },
    {
      slug: 'gota-patti-dupatta',
      name: 'Gota Patti Dupatta',
      categories: ['dupattas'],
      price: rs(2150),
      description:
        'Marigold chiffon dupatta with gota patti borders and tassels.',
      attributes: {
        fabric: 'Chiffon',
        colour: 'Yellow',
        length: '2.5 m',
        care: 'Dry clean only',
      },
      ageDays: 9,
      images: 4,
      variants: [{ options: {}, stock: 10 }],
    },
    {
      slug: 'bandhani-silk-dupatta',
      name: 'Bandhani Silk Dupatta',
      categories: ['dupattas'],
      price: rs(2890),
      description:
        'Hand-tied bandhani on gaji silk from Kutch, in a deep festive red.',
      attributes: {
        fabric: 'Gaji silk',
        colour: 'Red',
        length: '2.4 m',
        care: 'Dry clean only',
      },
      featured: true,
      ageDays: 17,
      images: 4,
      variants: [{ options: {}, stock: 6 }],
    },
    {
      slug: 'organza-floral-dupatta',
      name: 'Organza Floral Dupatta',
      categories: ['dupattas'],
      price: rs(1950),
      compareAt: rs(2400),
      description: 'Sheer pink organza with printed florals and a lace edge.',
      attributes: {
        fabric: 'Organza',
        colour: 'Pink',
        length: '2.4 m',
        care: 'Dry clean only',
      },
      ageDays: 41,
      images: 4,
      variants: [{ options: {}, stock: 8 }],
    },
  ],
};

export const fixtureStores: FixtureStore[] = [sareeStore, boutiqueStore];
