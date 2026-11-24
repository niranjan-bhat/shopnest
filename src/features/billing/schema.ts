import { z } from 'zod';
import { parseRupees, type Paise } from '@/lib/money';

// Plans, payments and limits. Amounts and numbers stay as typed in forms and
// become paise and integers here; the actions parse the same input again.

const rupees = (message: string, min: Paise) =>
  z
    .string()
    .trim()
    .transform((value, ctx): Paise => {
      const paise = parseRupees(value);
      if (paise === null || paise < min || paise > 100_000_000_00) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return paise;
    });

/** A whole number, or null when left empty (unlimited). */
const limit = z
  .string()
  .trim()
  .transform((value, ctx): number | null => {
    if (value === '') return null;
    if (!/^[1-9]\d{0,5}$/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a whole number, or leave it empty for no limit',
      });
      return z.NEVER;
    }
    return Number(value);
  });

export const planSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(60, 'Keep it under 60 characters'),
  setupFee: rupees('Enter an amount in rupees, or 0', 0),
  monthlyFee: rupees('Enter an amount in rupees, or 0', 0),
  maxProducts: limit,
  maxTeam: limit,
  isActive: z.boolean(),
});
export type PlanInput = z.input<typeof planSchema>;
export type PlanValues = z.output<typeof planSchema>;
export type PlanField = keyof PlanValues;

const day = z.iso.date('Choose a date');

export const subscriptionSchema = z.object({
  storeId: z.uuid(),
  planId: z.uuid('Choose a plan'),
  /** Empty: not billed. */
  billingStart: z.union([z.literal(''), day]),
});

export const PAYMENT_METHODS = {
  upi: 'UPI',
  bank: 'Bank transfer',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const MAX_MONTHS = 36;

export const paymentSchema = z.object({
  storeId: z.uuid(),
  /** Made by the form, so a double click records one payment. */
  paymentId: z.uuid(),
  amount: rupees('Enter the amount paid, in rupees', 1),
  paidOn: day,
  method: z.enum(
    Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]],
  ),
  months: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, 'Enter a number of months')
    .transform(Number)
    .refine((n) => n <= MAX_MONTHS, `At most ${MAX_MONTHS} months`),
  reference: z.string().trim().max(120, 'Keep it under 120 characters'),
});
export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentValues = z.output<typeof paymentSchema>;
export type PaymentField = keyof PaymentValues;

export const voidSchema = z.object({
  storeId: z.uuid(),
  paymentId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, 'Say why')
    .max(500, 'Keep it under 500 characters'),
});

/** plans.limits; a missing key is unlimited. */
const limitsSchema = z.object({
  products: z.number().int().positive().nullish(),
  team: z.number().int().positive().nullish(),
});

export type PlanLimits = { products: number | null; team: number | null };

export function parseLimits(raw: unknown): PlanLimits {
  const parsed = limitsSchema.safeParse(raw);
  return {
    products: (parsed.success && parsed.data.products) || null,
    team: (parsed.success && parsed.data.team) || null,
  };
}

/** "37 of 100", or "37" without a limit. */
export function usageText(used: number, max: number | null): string {
  return max === null ? String(used) : `${used} of ${max}`;
}

/** Postgres error codes raised by the limit triggers. */
export const PRODUCT_LIMIT_CODE = 'ZL001';
export const TEAM_LIMIT_CODE = 'ZL002';

export const PRODUCT_LIMIT_MESSAGE =
  'Your plan’s product limit is reached. Archive or delete a product, or ask the Zarify team to move you to a bigger plan.';
