import 'server-only';
import { formatOptions } from '@/features/cart/cart';
import { orderOptions } from '@/features/catalog/mappers';
import { idSchema } from '@/features/catalog/schemas';
import type { Paise } from '@/lib/money';
import { adminDb } from '@/lib/supabase/admin';
import { check } from '@/lib/supabase/result';
import type { OrderStatus } from './status';

export type ShopperOrderLine = {
  name: string;
  /** e.g. "Indigo · M"; empty for products without options. */
  optionsLabel: string;
  qty: number;
  /** Null when the price is on request. */
  unitPricePaise: Paise | null;
};

/**
 * An order as the shopper's confirmation page shows it. Anyone with the
 * link can open that page, so it carries no phone number or address.
 */
export type ShopperOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  lines: ShopperOrderLine[];
  subtotalPaise: Paise;
  totalPaise: Paise;
  /** Some prices are still to be confirmed by the store. */
  hasPriceOnRequest: boolean;
};

/**
 * One of a store's orders, for its confirmation page. Shoppers have no
 * access to orders, so this reads with the service role, always within the
 * store. Null for unknown ids and other stores' orders. Not cached: the
 * status changes as the store works on the order.
 */
export async function getShopperOrder(
  tenantId: string,
  orderId: string,
): Promise<ShopperOrder | null> {
  if (!idSchema.safeParse(orderId).success) return null;
  const order = check(
    await adminDb()
      .from('orders')
      .select(
        `id, order_number, status, created_at, subtotal_paise, total_paise,
         order_items (name_snapshot, options_snapshot, qty, unit_price_paise, position)`,
      )
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle(),
    'orders',
  );
  if (!order) return null;
  const lines = [...order.order_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      name: item.name_snapshot,
      optionsLabel: formatOptions(
        orderOptions(item.options_snapshot as Record<string, string>),
      ),
      qty: item.qty,
      unitPricePaise: item.unit_price_paise,
    }));
  return {
    id: order.id,
    number: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    lines,
    subtotalPaise: order.subtotal_paise,
    totalPaise: order.total_paise,
    hasPriceOnRequest: lines.some((l) => l.unitPricePaise === null),
  };
}
