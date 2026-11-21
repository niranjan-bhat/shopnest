import { z } from 'zod';
import { SLUG_MAX, SLUG_PATTERN, slugify } from '@/lib/slug';

// Dashboard catalog forms. The same schemas run in the browser (instant
// feedback) and in the Server Actions (the real check).

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(80, 'Keep the name under 80 characters'),
  /** Empty means "make one from the name". */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX, `Keep the URL under ${SLUG_MAX} characters`)
    .refine(
      (value) => value === '' || SLUG_PATTERN.test(value),
      'Use lower-case letters, numbers and single hyphens',
    ),
  isActive: z.boolean(),
  /** Also listed in the storefront's top menu. */
  showInMenu: z.boolean(),
});

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
export type CategoryField = keyof CategoryFormValues;

/** The slug to save: the one typed in, or one made from the name. */
export function categorySlug(values: CategoryFormValues): string {
  return values.slug || slugify(values.name);
}

export const idSchema = z.uuid();

export const categoryVisibilitySchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});

/** Every category of the store, in the new order. */
export const categoryOrderSchema = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate category');
