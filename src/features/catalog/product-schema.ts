import { z } from 'zod';
import type { Json } from '@/types/database';
import { parseRupees, type Paise } from '@/lib/money';
import { SLUG_MAX, SLUG_PATTERN, slugify } from '@/lib/slug';
import {
  CLOTHING_ATTRIBUTES,
  CLOTHING_ATTRIBUTE_KEYS,
  type ClothingAttributeKey,
} from './attributes';
import { optionKey, type VariantDraft } from './variant-builder';

// The dashboard product form. The browser validates with it for instant
// feedback; the save action validates the same raw input again and turns it
// into the payload for save_product(). Amounts stay strings (as typed) until
// toProductPayload converts them to paise.

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Products per page in the dashboard list. */
export const PRODUCT_PAGE_SIZE = 25;

const listFilterSchema = z.object({
  status: z.enum(['all', ...PRODUCT_STATUSES]).catch('all'),
  search: z.string().trim().max(100).catch(''),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/** The product list's ?status=, ?q= and ?page=, ignoring anything invalid. */
export function parseProductListFilter(
  params: Record<string, string | string[] | undefined>,
): { status: ProductStatus | 'all'; search: string; page: number } {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return listFilterSchema.parse({
    status: first(params.status) ?? 'all',
    search: first(params.q) ?? '',
    page: first(params.page) ?? 1,
  });
}

const MAX_STOCK = 1_000_000;
const MAX_VARIANTS = 300;

const optionValue = z
  .string()
  .trim()
  .min(1)
  .max(40, 'Keep option values under 40 characters');

const optionList = z
  .array(optionValue)
  .max(30, 'Up to 30 values')
  .refine(
    (values) =>
      new Set(values.map((v) => v.toLowerCase())).size === values.length,
    'Each value only once',
  );

const variantSchema = z.object({
  id: z.uuid().nullable(),
  options: z
    .object({ size: z.string().optional(), colour: z.string().optional() })
    .strict(),
  sku: z.string().trim().max(64, 'Keep the SKU under 64 characters'),
  price: z.string().trim(),
  stock: z.string().trim(),
  trackInventory: z.boolean(),
});

const attributesSchema = z.object(
  Object.fromEntries(
    CLOTHING_ATTRIBUTE_KEYS.map((key) => [
      key,
      z.string().trim().max(200, 'Keep it under 200 characters'),
    ]),
  ) as Record<ClothingAttributeKey, z.ZodString>,
);

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name')
      .max(200, 'Keep the name under 200 characters'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(SLUG_MAX, `Keep the URL under ${SLUG_MAX} characters`)
      .refine(
        (value) => value === '' || SLUG_PATTERN.test(value),
        'Use lower-case letters, numbers and single hyphens',
      ),
    description: z
      .string()
      .trim()
      .max(5000, 'Keep the description under 5,000 characters'),
    status: z.enum(PRODUCT_STATUSES),
    isFeatured: z.boolean(),
    priceMode: z.enum(['fixed', 'on_request']),
    price: z.string().trim(),
    compareAt: z.string().trim(),
    categoryIds: z.array(z.uuid()).max(50),
    attributes: attributesSchema,
    extraDetails: z
      .array(
        z.object({
          label: z
            .string()
            .trim()
            .min(1, 'Name the detail')
            .max(40, 'Keep it under 40 characters'),
          value: z
            .string()
            .trim()
            .min(1, 'Add a value')
            .max(200, 'Keep it under 200 characters'),
        }),
      )
      .max(20, 'Up to 20 extra details'),
    sizes: optionList,
    colours: optionList,
    variants: z.array(variantSchema).min(1).max(MAX_VARIANTS),
    seoTitle: z.string().trim().max(70, 'Keep it under 70 characters'),
    seoDescription: z.string().trim().max(160, 'Keep it under 160 characters'),
  })
  .superRefine((form, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    if (!form.slug && !slugify(form.name)) {
      issue(['slug'], 'Add a URL using English letters or numbers');
    }

    // Prices.
    if (form.priceMode === 'fixed') {
      const price = parseRupees(form.price);
      if (form.price === '') issue(['price'], 'Enter a price');
      else if (price === null) issue(['price'], 'Enter an amount like 2499');
      if (form.compareAt !== '') {
        const compareAt = parseRupees(form.compareAt);
        if (compareAt === null) {
          issue(['compareAt'], 'Enter an amount like 2999');
        } else if (price !== null && compareAt <= price) {
          issue(['compareAt'], 'Must be more than the price');
        }
      }
    }

    // Extra details must not repeat each other or the fields above.
    const taken = new Set<string>(
      CLOTHING_ATTRIBUTES.flatMap((a) => [a.key, a.label.toLowerCase()]),
    );
    form.extraDetails.forEach((detail, i) => {
      const label = detail.label.toLowerCase();
      if (taken.has(label)) {
        issue(
          ['extraDetails', i, 'label'],
          'Already a field above, or used twice',
        );
      }
      taken.add(label);
    });

    // Variants: exactly one row per colour × size, each valid.
    const expected = new Set<string>();
    const colours = form.colours.length > 0 ? form.colours : [undefined];
    const sizes = form.sizes.length > 0 ? form.sizes : [undefined];
    for (const colour of colours) {
      for (const size of sizes) expected.add(optionKey({ colour, size }));
    }
    const seen = new Set<string>();
    const skus = new Set<string>();
    form.variants.forEach((variant, i) => {
      const key = optionKey(variant.options);
      if (!expected.has(key) || seen.has(key)) {
        issue(['variants'], 'Sizes and colours changed. Check the variants.');
      }
      seen.add(key);

      if (!/^\d+$/.test(variant.stock) || Number(variant.stock) > MAX_STOCK) {
        issue(['variants', i, 'stock'], 'Whole number');
      }
      if (form.priceMode === 'fixed' && variant.price !== '') {
        if (parseRupees(variant.price) === null) {
          issue(['variants', i, 'price'], 'Amount like 2499');
        }
      }
      const sku = variant.sku.toLowerCase();
      if (sku) {
        if (skus.has(sku)) issue(['variants', i, 'sku'], 'Used twice');
        skus.add(sku);
      }
    });
    if (seen.size !== expected.size) {
      issue(['variants'], 'Sizes and colours changed. Check the variants.');
    }
  });

export type ProductFormValues = z.input<typeof productFormSchema>;

/** A blank form for a new product. */
export function emptyProductForm(): ProductFormValues {
  return {
    name: '',
    slug: '',
    description: '',
    status: 'draft',
    isFeatured: false,
    priceMode: 'fixed',
    price: '',
    compareAt: '',
    categoryIds: [],
    attributes: Object.fromEntries(
      CLOTHING_ATTRIBUTE_KEYS.map((key) => [key, '']),
    ) as Record<ClothingAttributeKey, string>,
    extraDetails: [],
    sizes: [],
    colours: [],
    variants: [
      {
        id: null,
        options: {},
        sku: '',
        price: '',
        stock: '0',
        trackInventory: true,
      } satisfies VariantDraft,
    ],
    seoTitle: '',
    seoDescription: '',
  };
}

/** What save_product() receives (snake_case columns, paise). */
export type ProductPayload = {
  name: string;
  slug: string;
  description: string | null;
  price_mode: 'fixed' | 'on_request';
  price_paise: Paise | null;
  compare_at_paise: Paise | null;
  status: ProductStatus;
  is_featured: boolean;
  attributes: Record<string, string>;
  seo: { title?: string; description?: string };
  category_ids: string[];
  variants: {
    id: string | null;
    sku: string | null;
    options: Record<string, string>;
    price_paise: Paise | null;
    stock_qty: number;
    track_inventory: boolean;
  }[];
};

/** Converts validated form values (schema output) into the save payload. */
export function toProductPayload(
  form: z.output<typeof productFormSchema>,
): ProductPayload {
  const fixed = form.priceMode === 'fixed';
  const attributes: Record<string, string> = {};
  for (const key of CLOTHING_ATTRIBUTE_KEYS) {
    if (form.attributes[key]) attributes[key] = form.attributes[key];
  }
  for (const detail of form.extraDetails) {
    attributes[detail.label] = detail.value;
  }
  const seo: ProductPayload['seo'] = {};
  if (form.seoTitle) seo.title = form.seoTitle;
  if (form.seoDescription) seo.description = form.seoDescription;

  return {
    name: form.name,
    slug: form.slug || slugify(form.name),
    description: form.description || null,
    price_mode: form.priceMode,
    price_paise: fixed ? parseRupees(form.price) : null,
    compare_at_paise:
      fixed && form.compareAt ? parseRupees(form.compareAt) : null,
    status: form.status,
    is_featured: form.isFeatured,
    attributes,
    seo,
    category_ids: [...new Set(form.categoryIds)],
    variants: form.variants.map((variant) => {
      const options: Record<string, string> = {};
      if (variant.options.colour) options.colour = variant.options.colour;
      if (variant.options.size) options.size = variant.options.size;
      return {
        id: variant.id,
        sku: variant.sku || null,
        options,
        price_paise: fixed && variant.price ? parseRupees(variant.price) : null,
        stock_qty: Number(variant.stock),
        track_inventory: variant.trackInventory,
      };
    }),
  };
}

/** The payload as the Json the RPC accepts (checked by the compiler). */
export function payloadJson(payload: ProductPayload): Json {
  return payload;
}
