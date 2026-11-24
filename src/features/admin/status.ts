import { z } from 'zod';

// Going live and suspending, shared by the screens and the actions.

export const storeStatusSchema = z.discriminatedUnion('status', [
  z.object({ storeId: z.uuid(), status: z.literal('active') }),
  z.object({
    storeId: z.uuid(),
    status: z.literal('suspended'),
    reason: z
      .string()
      .trim()
      .min(1, 'Say why. The merchant sees this.')
      .max(500, 'Keep it under 500 characters'),
  }),
]);

/** What can stop a store going live (store_missing in the database). */
export const MISSING = ['theme', 'products'] as const;
export type Missing = (typeof MISSING)[number];

export const missingSchema = z.array(z.enum(MISSING));

/** The jsonb set_store_status returns. */
export const statusResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('not_ready'), missing: missingSchema }),
]);

export const CHECKLIST: Record<Missing, string> = {
  theme: 'Storefront published at least once',
  products: 'At least one active product',
};
