'use server';

import { headers } from 'next/headers';
import { formatOptions } from '@/features/cart/cart';
import { orderOptions } from '@/features/catalog/mappers';
import { formatAddress } from '@/features/checkout/schema';
import { getStoreByHost } from '@/features/tenants/queries';
import { getServerEnv } from '@/lib/env';
import { adminDb } from '@/lib/supabase/admin';
import { buildOrderMessage, waLink } from '@/lib/whatsapp';
import { clientAddress, clientHash } from './client';
import {
  createOrderSchema,
  placeOrderResultSchema,
  type CreateOrderInput,
  type CreateOrderResult,
} from './schema';

const TRY_AGAIN = 'Something went wrong placing your order. Please try again.';

/** The shopper's network address as a keyed hash, or null (local, unknown). */
function clientKey(requestHeaders: Headers): string | null {
  const ip = clientAddress(requestHeaders);
  return ip ? clientHash(ip, getServerEnv().SUPABASE_SERVICE_ROLE_KEY) : null;
}

/**
 * Places a storefront order. The store comes from the request's host name,
 * never from the browser. place_order re-prices every line from the
 * database: if anything changed since the shopper saw it, nothing is saved
 * and the changes come back for the shopper to confirm. Once placed, the
 * WhatsApp message is written from the server's prices and order number.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      error:
        parsed.error.issues[0]?.message ?? 'Check your details and try again.',
    };
  }
  const { checkoutId, customer, lines, website } = parsed.data;
  const requestHeaders = await headers();

  // The hidden field was filled in: a bot. Save nothing and say little.
  if (website) {
    console.warn('Checkout refused: hidden field filled in');
    return { status: 'error', error: TRY_AGAIN };
  }

  const store = await getStoreByHost(requestHeaders.get('host') ?? '');
  if (!store) {
    return {
      status: 'error',
      error: "This store isn't taking orders right now.",
    };
  }

  const { data, error } = await adminDb().rpc('place_order', {
    tid: store.id,
    checkout: checkoutId,
    customer: {
      name: customer.name,
      phone: `+91${customer.phone}`,
      notes: customer.notes,
      address: {
        line1: customer.addressLine1,
        line2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
      },
    },
    items: lines.map((line) => ({
      variant_id: line.variantId,
      qty: line.qty,
      unit_price_paise: line.unitPricePaise,
    })),
    client: clientKey(requestHeaders) ?? undefined,
  });
  if (error) {
    // P0002: the store closed between loading the page and ordering.
    if (error.code === 'P0002') {
      return {
        status: 'error',
        error: "This store isn't taking orders right now.",
      };
    }
    console.error('place_order failed', error);
    return { status: 'error', error: TRY_AGAIN };
  }

  const result = placeOrderResultSchema.safeParse(data);
  if (!result.success) {
    console.error('place_order returned an unexpected shape', result.error);
    return { status: 'error', error: TRY_AGAIN };
  }
  const placed = result.data;

  if (placed.status === 'limited') {
    return {
      status: 'limited',
      error: `You've placed several orders in the last hour. Please message ${store.name} on WhatsApp, or try again later.`,
      whatsappUrl: waLink(
        store.whatsappNumber,
        `Hello ${store.name}, I'd like to place an order.`,
      ),
    };
  }

  if (placed.status === 'changed') {
    return {
      status: 'changed',
      changes: placed.lines.map((line) => ({
        variantId: line.variant_id,
        problems: line.problems,
        unitPricePaise: line.unit_price_paise,
        availableQty: line.available_qty,
      })),
    };
  }

  const message = buildOrderMessage({
    storeName: store.name,
    orderNumber: String(placed.order_number),
    lines: placed.lines.map((line) => ({
      name: line.name,
      // jsonb keeps keys in its own order; show them in display order.
      optionsLabel: formatOptions(orderOptions(line.options)),
      qty: line.qty,
      unitPricePaise: line.unit_price_paise,
    })),
    subtotalPaise: placed.subtotal_paise,
    hasPriceOnRequest: placed.has_price_on_request,
    customer: {
      name: customer.name,
      phone: `+91 ${customer.phone}`,
      address: formatAddress(customer),
      notes: customer.notes || undefined,
    },
  });

  return {
    status: 'placed',
    orderId: placed.order_id,
    whatsappUrl: waLink(store.whatsappNumber, message),
  };
}
