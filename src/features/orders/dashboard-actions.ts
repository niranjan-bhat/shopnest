'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { formatOptions } from '@/features/cart/cart';
import { catalogChanged } from '@/features/catalog/cache';
import { orderOptions } from '@/features/catalog/mappers';
import { idSchema } from '@/features/catalog/schemas';
import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import { ORDER_STATUSES, type OrderStatus } from './status';

// Order changes from the dashboard. Status and prices go through
// set_order_status and set_order_prices, which move stock and totals in the
// same transaction (supabase/migrations/…_order_status.sql).

const GONE = 'That order no longer exists.';
const MOVED =
  'This order changed in another window. Reload the page to see where it is now.';

export type ShortLine = {
  name: string;
  optionsLabel: string;
  qty: number;
  available: number;
};

export type SetStatusResult =
  { ok: true } | { ok: false; error: string; short?: ShortLine[] };

const shortResult = z.object({
  status: z.literal('short'),
  lines: z.array(
    z.object({
      name: z.string(),
      options: z.record(z.string(), z.string()),
      qty: z.number().int(),
      available: z.number().int(),
    }),
  ),
});

/** Moves an order to its next status; confirming takes stock. */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<SetStatusResult> {
  const { store } = await requireStoreForAction();
  const id = idSchema.safeParse(orderId);
  const next = z.enum(ORDER_STATUSES).safeParse(status);
  if (!id.success) return { ok: false, error: GONE };
  if (!next.success) return { ok: false, error: MOVED };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('set_order_status', {
    tid: store.id,
    ord: id.data,
    next: next.data,
  });
  if (error) {
    if (error.code === 'P0002') return { ok: false, error: GONE };
    if (error.code === '22023') return { ok: false, error: MOVED };
    throw new Error(`Changing order status failed: ${error.message}`);
  }

  const outcome = (data as { status?: string } | null)?.status;
  if (outcome === 'needs_prices') {
    return {
      ok: false,
      error: 'Enter a price for every item priced on request first.',
    };
  }
  if (outcome === 'short') {
    const short = shortResult.parse(data);
    return {
      ok: false,
      error: 'Not enough stock to confirm this order.',
      short: short.lines.map((line) => ({
        name: line.name,
        optionsLabel: formatOptions(orderOptions(line.options)),
        qty: line.qty,
        available: line.available,
      })),
    };
  }
  // Confirming and cancelling move stock, which the store shows.
  if (next.data === 'confirmed' || next.data === 'cancelled') {
    catalogChanged(store.id);
  } else {
    refresh();
  }
  return { ok: true };
}

const pricesSchema = z
  .array(
    z.object({
      itemId: z.uuid(),
      unitPricePaise: z
        .number()
        .int()
        .min(0)
        .max(1_000_000_000, 'Enter a smaller price')
        .nullable(),
    }),
  )
  .min(1)
  .max(50);

/** Saves the agreed prices of price-on-request lines (pending orders). */
export async function saveOrderPrices(
  orderId: string,
  prices: z.input<typeof pricesSchema>,
): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const id = idSchema.safeParse(orderId);
  if (!id.success) return { ok: false, error: GONE };
  const parsed = pricesSchema.safeParse(prices);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check the prices.',
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_order_prices', {
    tid: store.id,
    ord: id.data,
    prices: parsed.data.map((p) => ({
      item_id: p.itemId,
      unit_price_paise: p.unitPricePaise,
    })),
  });
  if (error) {
    if (error.code === 'P0002') return { ok: false, error: GONE };
    if (error.code === '22023') return { ok: false, error: MOVED };
    throw new Error(`Saving order prices failed: ${error.message}`);
  }
  refresh();
  return { ok: true };
}

const notesSchema = z
  .string()
  .trim()
  .max(2000, 'Keep notes under 2,000 characters');

/** The store's own notes on an order (never shown to the customer). */
export async function saveOrderNotes(
  orderId: string,
  notes: string,
): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const id = idSchema.safeParse(orderId);
  if (!id.success) return { ok: false, error: GONE };
  const parsed = notesSchema.safeParse(notes);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('orders')
    .update({ staff_notes: parsed.data || null })
    .eq('tenant_id', store.id)
    .eq('id', id.data)
    .select('id');
  if (error) throw new Error(`Saving order notes failed: ${error.message}`);
  if ((data ?? []).length === 0) return { ok: false, error: GONE };
  refresh();
  return { ok: true };
}
