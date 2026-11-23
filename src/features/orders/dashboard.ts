import 'server-only';
import { z } from 'zod';
import { formatOptions } from '@/features/cart/cart';
import { likePattern } from '@/features/catalog/dashboard';
import { orderOptions } from '@/features/catalog/mappers';
import type { Paise } from '@/lib/money';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { ORDER_STATUSES, type LineStock, type OrderStatus } from './status';

// Order reads for the merchant dashboard. They run as the signed-in user
// (RLS: the store's team only), are never cached, and filter by tenant_id
// explicitly.

export const ORDER_PAGE_SIZE = 25;

export type OrderListFilter = {
  status: OrderStatus | 'all';
  /** An order number, part of a phone number, or part of a name. */
  search: string;
  /** 1-based. */
  page: number;
};

const listFilterSchema = z.object({
  status: z.enum(['all', ...ORDER_STATUSES]).catch('all'),
  search: z.string().trim().max(80).catch(''),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export function parseOrderListFilter(
  params: Record<string, string | string[] | undefined>,
): OrderListFilter {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return listFilterSchema.parse({
    status: first(params.status) ?? 'all',
    search: first(params.q) ?? '',
    page: first(params.page) ?? 1,
  });
}

export type DashboardOrderRow = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  itemCount: number;
  totalPaise: Paise;
  /** Some price-on-request lines still have no price. */
  needsPrices: boolean;
};

export type OrderPage = { orders: DashboardOrderRow[]; total: number };
export type OrderCounts = Record<OrderStatus | 'all', number>;

/** PostgREST's answer to a page past the end ("range not satisfiable"). */
const PAST_LAST_PAGE = 'PGRST103';

/**
 * A search of digits (an order number or part of a phone number) as a
 * PostgREST `or` filter; null for other searches, which match the name.
 */
export function numberSearch(search: string): string | null {
  const text = search.trim();
  if (!text) return null;
  const digits = text.replace(/[\s#+-]/g, '');
  if (/^\d+$/.test(digits)) {
    return digits.length <= 9
      ? `order_number.eq.${digits},customer_phone.like.*${digits}*`
      : `customer_phone.like.*${digits.slice(-10)}*`;
  }
  return null;
}

/** One page of the store's orders, newest first, and how many match. */
export async function listDashboardOrders(
  tenantId: string,
  filter: OrderListFilter,
): Promise<OrderPage> {
  const supabase = await createServerSupabase();
  const from = (filter.page - 1) * ORDER_PAGE_SIZE;
  let query = supabase
    .from('orders')
    .select(
      `id, order_number, status, created_at, customer_name, total_paise,
       order_items(qty, unit_price_paise)`,
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + ORDER_PAGE_SIZE - 1);
  if (filter.status !== 'all') query = query.eq('status', filter.status);
  const numeric = numberSearch(filter.search);
  if (numeric) query = query.or(numeric);
  else if (filter.search) {
    query = query.ilike('customer_name', likePattern(filter.search));
  }
  const result = await query;
  if (result.error?.code === PAST_LAST_PAGE) {
    return { orders: [], total: result.count ?? 0 };
  }
  const rows = check(result, 'orders');
  return {
    total: result.count ?? rows.length,
    orders: rows.map((row) => ({
      id: row.id,
      number: row.order_number,
      status: row.status,
      createdAt: row.created_at,
      customerName: row.customer_name,
      itemCount: row.order_items.reduce((n, item) => n + item.qty, 0),
      totalPaise: row.total_paise,
      needsPrices: row.order_items.some((i) => i.unit_price_paise === null),
    })),
  };
}

/** How many orders the store has in each status (for the list's tabs). */
export async function countDashboardOrders(
  tenantId: string,
): Promise<OrderCounts> {
  const supabase = await createServerSupabase();
  const count = async (status: OrderStatus | 'all') => {
    let query = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (status !== 'all') query = query.eq('status', status);
    const { count: n, error } = await query;
    if (error)
      throw new Error(`Supabase query failed (orders): ${error.message}`);
    return [status, n ?? 0] as const;
  };
  const entries = await Promise.all(
    (['all', ...ORDER_STATUSES] as const).map(count),
  );
  return Object.fromEntries(entries) as OrderCounts;
}

const addressSchema = z.object({
  line1: z.string().catch(''),
  line2: z.string().catch(''),
  city: z.string().catch(''),
  state: z.string().catch(''),
  pincode: z.string().catch(''),
});

export type OrderAddress = z.infer<typeof addressSchema>;

export type DashboardOrderLine = {
  id: string;
  name: string;
  optionsLabel: string;
  qty: number;
  unitPricePaise: Paise | null;
  /** On request when ordered; its price is agreed with the customer. */
  priceOnRequest: boolean;
  /** The item's stock in the catalog now. */
  stock: LineStock;
};

export type DashboardOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customer: {
    name: string;
    phone: string;
    address: OrderAddress;
    /** What the customer wrote at checkout. */
    note: string;
  };
  /** The store's own notes; the customer never sees them. */
  staffNotes: string;
  lines: DashboardOrderLine[];
  subtotalPaise: Paise;
  totalPaise: Paise;
};

function lineStock(
  variant: { stock_qty: number; track_inventory: boolean } | null,
): LineStock {
  if (!variant) return { kind: 'gone' };
  return variant.track_inventory
    ? { kind: 'tracked', available: variant.stock_qty }
    : { kind: 'untracked' };
}

/** One of the store's orders with its lines; null if it is not theirs. */
export async function getDashboardOrder(
  tenantId: string,
  orderId: string,
): Promise<DashboardOrder | null> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('orders')
      .select(
        `id, order_number, status, created_at, updated_at, customer_name,
         customer_phone, address, notes, staff_notes, subtotal_paise,
         total_paise,
         order_items(id, name_snapshot, options_snapshot, qty,
                     unit_price_paise, price_on_request, position,
                     product_variants(stock_qty, track_inventory))`,
      )
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle(),
    'orders',
  );
  if (!row) return null;
  return {
    id: row.id,
    number: row.order_number,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      address: addressSchema.parse(row.address ?? {}),
      note: row.notes ?? '',
    },
    staffNotes: row.staff_notes ?? '',
    lines: [...row.order_items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        name: item.name_snapshot,
        optionsLabel: formatOptions(
          orderOptions(item.options_snapshot as Record<string, string>),
        ),
        qty: item.qty,
        unitPricePaise: item.unit_price_paise,
        priceOnRequest: item.price_on_request,
        stock: lineStock(item.product_variants),
      })),
    subtotalPaise: row.subtotal_paise,
    totalPaise: row.total_paise,
  };
}
