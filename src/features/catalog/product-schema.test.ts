import { describe, expect, it } from 'vitest';
import {
  emptyProductForm,
  parseProductListFilter,
  productFormSchema,
  toProductPayload,
  type ProductFormValues,
} from './product-schema';
import { buildVariants } from './variant-builder';

const form = (extra: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyProductForm(),
  name: 'Rust Kurta Set',
  price: '2,499',
  ...extra,
});

/** The messages for one path, e.g. errorsAt(result, 'compareAt'). */
function errorsAt(values: ProductFormValues, path: string): string[] {
  const result = productFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues
    .filter((i) => i.path.join('.') === path)
    .map((i) => i.message);
}

describe('productFormSchema', () => {
  it('accepts a simple product', () => {
    expect(productFormSchema.safeParse(form()).success).toBe(true);
  });

  it('requires a valid price for fixed-price products', () => {
    expect(errorsAt(form({ price: '' }), 'price')).toEqual(['Enter a price']);
    expect(errorsAt(form({ price: '24.999' }), 'price')).toEqual([
      'Enter an amount like 2499',
    ]);
  });

  it('needs no price when it is on request', () => {
    expect(
      productFormSchema.safeParse(form({ priceMode: 'on_request', price: '' }))
        .success,
    ).toBe(true);
  });

  it('requires the compare-at price to be higher', () => {
    expect(errorsAt(form({ compareAt: '2499' }), 'compareAt')).toEqual([
      'Must be more than the price',
    ]);
    expect(errorsAt(form({ compareAt: '2999' }), 'compareAt')).toEqual([]);
  });

  it('rejects extra details that repeat a field', () => {
    const values = form({
      extraDetails: [
        { label: 'Fabric', value: 'Silk' },
        { label: 'Work', value: 'Gota patti' },
        { label: 'work', value: 'Again' },
      ],
    });
    expect(errorsAt(values, 'extraDetails.0.label')).toHaveLength(1);
    expect(errorsAt(values, 'extraDetails.1.label')).toEqual([]);
    expect(errorsAt(values, 'extraDetails.2.label')).toHaveLength(1);
  });

  it('checks each variant', () => {
    const variants = buildVariants({ sizes: ['S', 'M'], colours: [] }, []);
    variants[0] = { ...variants[0], stock: '2.5', sku: 'KS-1' };
    variants[1] = { ...variants[1], price: 'abc', sku: 'ks-1' };
    const values = form({ sizes: ['S', 'M'], variants });
    expect(errorsAt(values, 'variants.0.stock')).toEqual(['Whole number']);
    expect(errorsAt(values, 'variants.1.price')).toEqual(['Amount like 2499']);
    expect(errorsAt(values, 'variants.1.sku')).toEqual(['Used twice']);
  });

  it('requires one variant per size and colour', () => {
    const values = form({
      sizes: ['S', 'M'],
      variants: buildVariants({ sizes: ['S'], colours: [] }, []),
    });
    expect(errorsAt(values, 'variants')).not.toEqual([]);
  });

  it('asks for a URL when the name has no English letters', () => {
    expect(errorsAt(form({ name: 'साड़ी' }), 'slug')).toHaveLength(1);
  });
});

describe('toProductPayload', () => {
  it('converts rupees to paise and drops empty fields', () => {
    const values = form({
      compareAt: '2999.50',
      attributes: { ...emptyProductForm().attributes, fabric: 'Cotton' },
      extraDetails: [{ label: 'Work', value: 'Gota patti' }],
      seoTitle: 'Rust kurta',
      sizes: ['M'],
      variants: [
        {
          id: null,
          options: { size: 'M' },
          sku: '',
          price: '2599',
          stock: '3',
          trackInventory: true,
        },
      ],
    });
    const payload = toProductPayload(productFormSchema.parse(values));
    expect(payload).toMatchObject({
      slug: 'rust-kurta-set',
      description: null,
      price_paise: 249900,
      compare_at_paise: 299950,
      attributes: { fabric: 'Cotton', Work: 'Gota patti' },
      seo: { title: 'Rust kurta' },
      variants: [
        {
          id: null,
          sku: null,
          options: { size: 'M' },
          price_paise: 259900,
          stock_qty: 3,
        },
      ],
    });
  });

  it('clears all prices when the price is on request', () => {
    const values = form({ priceMode: 'on_request', compareAt: '9999' });
    values.variants[0] = { ...values.variants[0], price: '100' };
    const payload = toProductPayload(productFormSchema.parse(values));
    expect(payload.price_paise).toBeNull();
    expect(payload.compare_at_paise).toBeNull();
    expect(payload.variants[0].price_paise).toBeNull();
  });
});

describe('parseProductListFilter', () => {
  it('reads status, search and page', () => {
    expect(
      parseProductListFilter({ status: 'draft', q: ' silk ', page: '3' }),
    ).toEqual({ status: 'draft', search: 'silk', page: 3 });
  });

  it('falls back to the first page of everything', () => {
    expect(parseProductListFilter({})).toEqual({
      status: 'all',
      search: '',
      page: 1,
    });
    for (const page of ['0', '-2', '1.5', 'two', '99999']) {
      expect(parseProductListFilter({ page }).page).toBe(1);
    }
    expect(parseProductListFilter({ status: 'deleted' }).status).toBe('all');
  });
});
