import type { Database } from '@/types/database';

export type OrderStatus = Database['public']['Enums']['order_status'];

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const satisfies readonly OrderStatus[];

/**
 * Where an order can go next, one step at a time; set_order_status enforces
 * the same moves (supabase/migrations/…_order_status.sql). An order can be
 * cancelled until it ships.
 */
export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** The merchant's name for each status (lists, badges, filters). */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** The button that moves an order to each status. */
export const MOVE_LABEL: Record<OrderStatus, string> = {
  pending: 'Mark as new',
  confirmed: 'Confirm order',
  packed: 'Mark as packed',
  shipped: 'Mark as shipped',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
};

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

/** Stock was taken when the order was confirmed and not yet returned. */
export function holdsStock(status: OrderStatus): boolean {
  return status === 'confirmed' || status === 'packed' || status === 'shipped';
}

/** An order line's item as it stands in the catalog now. */
export type LineStock =
  | { kind: 'tracked'; available: number }
  | { kind: 'untracked' }
  /** The variant was deleted after the order was placed. */
  | { kind: 'gone' };

/**
 * What a New order's line says about stock, so the merchant sees a
 * shortage before agreeing the order. `short` lines cannot be confirmed as
 * they stand; set_order_status makes the real check on Confirm.
 */
export function stockNote(
  stock: LineStock,
  qty: number,
): { text: string; short: boolean } {
  if (stock.kind === 'gone') {
    return { text: 'No longer in your catalogue', short: true };
  }
  if (stock.kind === 'untracked') {
    return { text: 'Stock not tracked', short: false };
  }
  const { available } = stock;
  if (available === 0) return { text: 'Out of stock', short: true };
  if (available < qty)
    return { text: `Only ${available} in stock`, short: true };
  return { text: `${available} in stock`, short: false };
}
