import { z } from 'zod';
import { MAX_QTY_PER_LINE } from '@/features/cart/cart';
import { checkoutSchema } from '@/features/checkout/schema';

/** Most lines one order can have (place_order refuses more). */
export const MAX_ORDER_LINES = 50;

const paise = z.number().int().nonnegative();

/**
 * What the checkout sends to createOrder. The prices are the ones the
 * shopper was shown: the server re-prices every line and only places the
 * order if they still match.
 */
export const createOrderSchema = z.object({
  /** One id per checkout, so a repeat returns the same order. */
  checkoutId: z.uuid(),
  customer: checkoutSchema,
  lines: z
    .array(
      z.object({
        variantId: z.uuid(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
        unitPricePaise: paise.nullable(),
      }),
    )
    .min(1, 'Your bag is empty.')
    .max(MAX_ORDER_LINES, `An order can have at most ${MAX_ORDER_LINES} items.`)
    .refine(
      (lines) => new Set(lines.map((l) => l.variantId)).size === lines.length,
      'An item appears twice in your bag.',
    ),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

const placedLine = z.object({
  variant_id: z.uuid().nullable(),
  name: z.string(),
  options: z.record(z.string(), z.string()),
  qty: z.number().int(),
  unit_price_paise: paise.nullable(),
});

export const ORDER_PROBLEMS = ['unavailable', 'stock', 'price'] as const;
export type OrderProblem = (typeof ORDER_PROBLEMS)[number];

const changedLine = z.object({
  variant_id: z.uuid(),
  problems: z.array(z.enum(ORDER_PROBLEMS)).min(1),
  unit_price_paise: paise.nullable(),
  available_qty: z.number().int().nonnegative().nullable(),
});

/** The jsonb place_order returns (supabase/migrations/…_place_order.sql). */
export const placeOrderResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('placed'),
    order_id: z.uuid(),
    order_number: z.number().int(),
    subtotal_paise: paise,
    total_paise: paise,
    has_price_on_request: z.boolean(),
    lines: z.array(placedLine).min(1),
  }),
  z.object({
    status: z.literal('changed'),
    lines: z.array(changedLine).min(1),
  }),
]);

export type PlaceOrderResult = z.infer<typeof placeOrderResultSchema>;

/** A line that changed since the shopper added it, as the checkout needs it. */
export type LineChange = {
  variantId: string;
  problems: OrderProblem[];
  /** Today's price; null when on request or no longer for sale. */
  unitPricePaise: number | null;
  /** How many are left when stock is tracked; null otherwise. */
  availableQty: number | null;
};

export type CreateOrderResult =
  | { status: 'placed'; orderId: string; whatsappUrl: string }
  | { status: 'changed'; changes: LineChange[] }
  | { status: 'error'; error: string };
