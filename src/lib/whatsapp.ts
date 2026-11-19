import { formatINR, type Paise } from './money';

/** Digits only, as wa.me expects: "+91 98765 43210" → "919876543210". */
export function waDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** A wa.me link that opens a chat with `phone`, pre-filled with `text`. */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export type OrderMessageLine = {
  name: string;
  optionsLabel: string;
  qty: number;
  /** Paise; null when the price is on request. */
  unitPricePaise: Paise | null;
};

export type OrderMessage = {
  storeName: string;
  lines: OrderMessageLine[];
  subtotalPaise: Paise;
  hasPriceOnRequest: boolean;
  customer: {
    name: string;
    phone: string;
    address: string;
    notes?: string;
  };
  /** Phase 4 adds the order number once orders are saved. */
  orderNumber?: string;
};

/** The plain-text order the shopper sends to the store on WhatsApp. */
export function buildOrderMessage(order: OrderMessage): string {
  const items = order.lines.map((line, i) => {
    const options = line.optionsLabel ? ` (${line.optionsLabel})` : '';
    const price =
      line.unitPricePaise === null
        ? 'price on request'
        : `${formatINR(line.unitPricePaise)} each`;
    return `${i + 1}. ${line.name}${options} × ${line.qty}, ${price}`;
  });

  const total = order.hasPriceOnRequest
    ? `Total: ${formatINR(order.subtotalPaise)} + items with price on request (to be confirmed)`
    : `Total: ${formatINR(order.subtotalPaise)}`;

  const { customer } = order;
  return [
    `Hello ${order.storeName}, I'd like to place an order${order.orderNumber ? ` (#${order.orderNumber})` : ''}:`,
    '',
    ...items,
    '',
    total,
    '',
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Delivery address: ${customer.address}`,
    ...(customer.notes ? [`Notes: ${customer.notes}`] : []),
  ].join('\n');
}
