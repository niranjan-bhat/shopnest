import { describe, expect, it } from 'vitest';
import { mockDb } from '@/mocks';
import type { Tables } from '@/types/database';
import {
  activeFilterCount,
  catalogFacets,
  filterCatalog,
  parseCatalogFilters,
  sortCatalog,
} from './filter';
import { imagesForColour } from './colours';
import { toCatalogItem, toProductDetail, type ProductRows } from './mappers';
import type { CatalogItem } from './types';
import {
  canBuy,
  findVariant,
  initialSelection,
  isValueAvailable,
  optionValues,
} from './variants';

const [saree, boutique] = mockDb.tenants as [
  Tables<'tenants'>,
  Tables<'tenants'>,
];

function rowsFor(tenantId: string, slug: string): ProductRows {
  const product = mockDb.products.find(
    (p) => p.tenant_id === tenantId && p.slug === slug,
  )!;
  const categoryIds = mockDb.product_categories
    .filter((pc) => pc.product_id === product.id)
    .map((pc) => pc.category_id);
  return {
    product,
    variants: mockDb.product_variants.filter(
      (v) => v.product_id === product.id,
    ),
    images: mockDb.product_images.filter((i) => i.product_id === product.id),
    categories: mockDb.categories.filter((c) => categoryIds.includes(c.id)),
  };
}

function catalog(tenantId: string): CatalogItem[] {
  return mockDb.products
    .filter((p) => p.tenant_id === tenantId && p.status === 'active')
    .map((p) => toCatalogItem(rowsFor(tenantId, p.slug)));
}

describe('mappers', () => {
  it('maps a fixed-price product', () => {
    const item = toCatalogItem(
      rowsFor(saree.id, 'ruby-temple-border-kanjivaram'),
    );
    expect(item.pricePaise).toBe(2_450_000);
    expect(item.inStock).toBe(true);
    expect(item.colours.map((c) => c.name)).toEqual(['Red']);
    expect(item.categorySlugs).toEqual(['kanjivaram']);
    expect(item.image?.key).toMatch(/\/1\.webp$/);
    expect(item.hoverImage?.key).toMatch(/\/2\.webp$/);
  });

  it('maps price-on-request to a null price on product and variants', () => {
    const detail = toProductDetail(
      rowsFor(saree.id, 'bridal-peacock-kanjivaram'),
    );
    expect(detail.pricePaise).toBeNull();
    expect(detail.variants.every((v) => v.pricePaise === null)).toBe(true);
  });

  it('marks sold-out and low-stock products', () => {
    expect(toCatalogItem(rowsFor(saree.id, 'coral-soft-silk')).inStock).toBe(
      false,
    );
    expect(
      toCatalogItem(rowsFor(saree.id, 'charcoal-linen-silver-border')).lowStock,
    ).toBe(true);
  });

  it('collects sizes in garment order and labels attributes', () => {
    const detail = toProductDetail(rowsFor(boutique.id, 'ikat-co-ord'));
    expect(detail.optionNames).toEqual(['colour', 'size']);
    expect(toCatalogItem(rowsFor(boutique.id, 'ikat-co-ord')).sizes).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
    ]);
    expect(detail.attributes).toContainEqual({
      label: 'Fabric',
      value: 'Handwoven cotton ikat',
    });
  });

  it('orders options and attributes for display, whatever the jsonb key order', () => {
    // Postgres returns jsonb keys shortest-first, e.g. {size, colour}.
    const rows = rowsFor(saree.id, 'ruby-temple-border-kanjivaram');
    const scrambled: ProductRows = {
      ...rows,
      product: {
        ...rows.product,
        attributes: {
          care: 'Dry clean',
          zari: 'Gold',
          fabric: 'Silk',
          mood: 'Calm',
        },
      },
      variants: rows.variants.map((v) => ({
        ...v,
        options: { size: 'M', colour: 'Rust', border: 'Gold' },
      })),
    };
    const detail = toProductDetail(scrambled);
    expect(detail.attributes.map((a) => a.label)).toEqual([
      'Fabric',
      'Zari',
      'Care',
      'Mood',
    ]);
    expect(detail.optionNames).toEqual(['colour', 'size', 'border']);
    expect(Object.values(detail.variants[0].options)).toEqual([
      'Rust',
      'M',
      'Gold',
    ]);
  });
});

describe('parseCatalogFilters', () => {
  it('reads valid params and ignores junk', () => {
    expect(
      parseCatalogFilters({
        sort: 'price-desc',
        price: ['under-5k', 'nonsense'],
        colour: 'Red',
        inStock: '1',
      }),
    ).toEqual({
      sort: 'price-desc',
      price: [],
      colour: ['red'],
      fabric: [],
      size: [],
      inStock: true,
    });
    expect(parseCatalogFilters({ sort: 'cheapest' }).sort).toBe('featured');
    expect(parseCatalogFilters({ price: '5k-10k' }).price).toEqual(['5k-10k']);
  });

  it('counts active filters', () => {
    expect(
      activeFilterCount(
        parseCatalogFilters({
          colour: ['Red', 'Blue'],
          size: 'M',
          inStock: '1',
        }),
      ),
    ).toBe(4);
  });
});

describe('filterCatalog and sortCatalog', () => {
  const items = catalog(saree.id);

  it('never includes draft products', () => {
    expect(items.some((i) => i.slug === 'unreleased-paithani')).toBe(false);
  });

  it('filters by price band, excluding price-on-request items', () => {
    const result = filterCatalog(
      items,
      parseCatalogFilters({ price: 'under-5k' }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((i) => i.pricePaise !== null && i.pricePaise < 500_000),
    ).toBe(true);
  });

  it('filters by colour, fabric and stock', () => {
    const blue = filterCatalog(items, parseCatalogFilters({ colour: 'Blue' }));
    expect(blue.length).toBeGreaterThan(0);
    expect(blue.every((i) => i.colour === 'Blue')).toBe(true);
    const inStock = filterCatalog(items, parseCatalogFilters({ inStock: '1' }));
    expect(inStock.some((i) => i.slug === 'coral-soft-silk')).toBe(false);
  });

  it('filters boutique products by size', () => {
    const xl = filterCatalog(
      catalog(boutique.id),
      parseCatalogFilters({ size: 'XL' }),
    );
    expect(xl.length).toBeGreaterThan(0);
    expect(xl.every((i) => i.sizes.includes('XL'))).toBe(true);
  });

  it('sorts by price with price-on-request last in both directions', () => {
    for (const sort of ['price-asc', 'price-desc'] as const) {
      const sorted = sortCatalog(items, sort);
      const priced = sorted.filter((i) => i.pricePaise !== null);
      const firstOnRequest = sorted.findIndex((i) => i.pricePaise === null);
      expect(firstOnRequest).toBe(priced.length);
      const prices = priced.map((i) => i.pricePaise!);
      const expected = [...prices].sort((a, b) =>
        sort === 'price-asc' ? a - b : b - a,
      );
      expect(prices).toEqual(expected);
    }
  });

  it('sorts newest first', () => {
    const sorted = sortCatalog(items, 'newest');
    expect(sorted[0]?.slug).toBe('blush-floral-organza');
  });

  it('builds facets only for values present', () => {
    const facets = catalogFacets(
      items.filter((i) => i.categorySlugs.includes('linen')),
    );
    expect(facets.colour.map((f) => f.value)).toEqual(['grey', 'natural']);
    expect(facets.colour.map((f) => f.label)).toEqual(['Grey', 'Natural']);
    expect(facets.size).toEqual([]);
  });
});

describe('variants', () => {
  const ikat = toProductDetail(rowsFor(boutique.id, 'ikat-co-ord'));

  it('lists option values in display order', () => {
    expect(optionValues(ikat.variants, 'colour')).toEqual(['Indigo', 'Rust']);
    expect(optionValues(ikat.variants, 'size')).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
    ]);
  });

  it('preselects colour but never size', () => {
    expect(initialSelection(ikat.variants, ikat.optionNames)).toEqual({
      colour: 'Indigo',
    });
  });

  it('finds a variant only when every option is chosen', () => {
    expect(
      findVariant(ikat.variants, ikat.optionNames, { colour: 'Rust' }),
    ).toBeUndefined();
    const v = findVariant(ikat.variants, ikat.optionNames, {
      colour: 'Rust',
      size: 'M',
    });
    expect(v?.options).toEqual({ colour: 'Rust', size: 'M' });
  });

  it('marks sold-out combinations unavailable', () => {
    // Rust XL has 0 in stock; Indigo XL has 1.
    expect(
      isValueAvailable(ikat.variants, { colour: 'Rust' }, 'size', 'XL'),
    ).toBe(false);
    expect(
      isValueAvailable(ikat.variants, { colour: 'Indigo' }, 'size', 'XL'),
    ).toBe(true);
  });

  it('selects the only variant of a product without options', () => {
    const saree1 = toProductDetail(
      rowsFor(saree.id, 'ruby-temple-border-kanjivaram'),
    );
    const selection = initialSelection(saree1.variants, saree1.optionNames);
    expect(
      findVariant(saree1.variants, saree1.optionNames, selection)?.id,
    ).toBe(saree1.variants[0]?.id);
  });
});

describe('colours', () => {
  const rows = rowsFor(boutique.id, 'ikat-co-ord');
  // Photo 1 for every colour, photo 2 rust, photo 3 a colour it lost.
  const tagged: ProductRows = {
    ...rows,
    images: rows.images.map((image, i) => ({
      ...image,
      colour: [null, 'rust ', 'Teal'][i] ?? null,
    })),
    variants: rows.variants.map((v) =>
      (v.options as { colour: string }).colour === 'Indigo'
        ? { ...v, stock_qty: 0 }
        : v,
    ),
  };
  const item = toCatalogItem(tagged);
  const filter = (params: Record<string, string>) =>
    filterCatalog([item], parseCatalogFilters(params));

  it('shows a colour its own photos, then those for every colour', () => {
    const { images } = toProductDetail(tagged);
    expect(images.map((i) => i.colour)).toEqual([null, 'Rust', null]);
    const keys = images.map((i) => i.key);
    expect(imagesForColour(images, 'Rust').map((i) => i.key)).toEqual([
      keys[1],
      keys[0],
      keys[2],
    ]);
    expect(imagesForColour(images, 'Indigo')).toEqual(images);
    expect(imagesForColour(images, undefined)).toEqual(images);
  });

  it('finds a product under each colour, however it is spelled', () => {
    const [rust] = filter({ colour: ' RUST ' });
    expect(rust?.colour).toBe('Rust');
    expect(rust?.image?.key).toBe(rows.images[1].r2_key);
    expect(filter({ colour: 'indigo' })).toHaveLength(1);
    expect(filter({ colour: 'Blue' })).toEqual([]);
    expect(filter({})[0].colour).toBeUndefined();
  });

  it('with "in stock", needs stock in that colour', () => {
    expect(filter({ colour: 'Rust', inStock: '1' })).toHaveLength(1);
    expect(filter({ colour: 'Indigo', inStock: '1' })).toEqual([]);
  });

  it('offers one choice per colour across spellings', () => {
    const other = {
      ...item,
      colours: [{ ...item.colours[0], name: 'indigo' }],
    };
    expect(catalogFacets([item, other]).colour).toEqual([
      { value: 'indigo', label: 'Indigo', count: 2 },
      { value: 'rust', label: 'Rust', count: 1 },
    ]);
  });

  it('opens on the cover photo colour if it can be bought', () => {
    const { variants, optionNames } = toProductDetail(rows);
    expect(initialSelection(variants, optionNames, 'Rust')).toEqual({
      colour: 'Rust',
    });
    const sold = toProductDetail(tagged);
    expect(initialSelection(sold.variants, sold.optionNames, 'Indigo')).toEqual(
      { colour: 'Rust' },
    );
    expect(canBuy(sold.variants, { colour: 'Indigo' })).toBe(false);
    expect(canBuy(sold.variants, { colour: 'Rust' })).toBe(true);
  });
});
