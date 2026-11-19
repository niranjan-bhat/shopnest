import { describe, expect, it } from 'vitest';
import { buildOrderMessage, waDigits, waLink } from './whatsapp';

const order = {
  storeName: 'Tara Weaves',
  lines: [
    {
      name: 'Ruby Kanjivaram',
      optionsLabel: '',
      qty: 1,
      unitPricePaise: 2_450_000,
    },
    {
      name: 'Ikat Co-ord',
      optionsLabel: 'Indigo · M',
      qty: 2,
      unitPricePaise: 399_000,
    },
  ],
  subtotalPaise: 3_248_000,
  hasPriceOnRequest: false,
  customer: {
    name: 'Asha Rao',
    phone: '+91 9876543210',
    address: '12 MG Road, Bengaluru, Karnataka 560001',
  },
};

describe('whatsapp', () => {
  it('normalises phone numbers to digits', () => {
    expect(waDigits('+91 98765-43210')).toBe('919876543210');
  });

  it('builds an encoded wa.me link', () => {
    const link = waLink('+91 98765 43210', 'Hi & bye?');
    expect(link).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye%3F');
  });

  it('writes out every line, the total and the customer details', () => {
    const message = buildOrderMessage(order);
    expect(message).toContain("Hello Tara Weaves, I'd like to place an order:");
    expect(message).toContain('1. Ruby Kanjivaram × 1, ₹24,500 each');
    expect(message).toContain('2. Ikat Co-ord (Indigo · M) × 2, ₹3,990 each');
    expect(message).toContain('Total: ₹32,480');
    expect(message).toContain('Name: Asha Rao');
    expect(message).toContain('Delivery address: 12 MG Road');
    expect(message).not.toContain('Notes:');
  });

  it('flags price-on-request items and a provisional total', () => {
    const message = buildOrderMessage({
      ...order,
      lines: [
        ...order.lines,
        {
          name: 'Bridal Kanjivaram',
          optionsLabel: '',
          qty: 1,
          unitPricePaise: null,
        },
      ],
      hasPriceOnRequest: true,
      customer: { ...order.customer, notes: 'Gift wrap please' },
    });
    expect(message).toContain('3. Bridal Kanjivaram × 1, price on request');
    expect(message).toContain('(to be confirmed)');
    expect(message).toContain('Notes: Gift wrap please');
  });

  it('round-trips through the wa.me link unchanged', () => {
    const message = buildOrderMessage(order);
    const url = new URL(waLink('+910000000001', message));
    expect(url.searchParams.get('text')).toBe(message);
  });
});
