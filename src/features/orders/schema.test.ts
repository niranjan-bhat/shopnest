import { describe, expect, it } from 'vitest';
import { createOrderSchema, placeOrderResultSchema } from './schema';

const customer = {
  name: 'Lakshmi Iyer',
  phone: '98765 43210',
  addressLine1: '12 Gandhi Road',
  city: 'Kanchipuram',
  state: 'Tamil Nadu',
  pincode: '631502',
};
const V1 = '00000001-0000-4000-8000-000000000001';
const V2 = '00000001-0000-4000-8000-000000000002';
const input = (lines: unknown[]) => ({
  checkoutId: 'd0000000-0000-4000-8000-000000000001',
  customer,
  lines,
});

describe('createOrderSchema', () => {
  it('accepts a bag and tidies the phone number', () => {
    const parsed = createOrderSchema.parse(
      input([
        { variantId: V1, qty: 2, unitPricePaise: 1_000_000 },
        { variantId: V2, qty: 1, unitPricePaise: null },
      ]),
    );
    expect(parsed.customer.phone).toBe('9876543210');
    expect(parsed.lines).toHaveLength(2);
  });

  it.each([
    ['an empty bag', []],
    ['a quantity of 0', [{ variantId: V1, qty: 0, unitPricePaise: 100 }]],
    ['more than 10', [{ variantId: V1, qty: 11, unitPricePaise: 100 }]],
    ['part of an item', [{ variantId: V1, qty: 1.5, unitPricePaise: 100 }]],
    ['a negative price', [{ variantId: V1, qty: 1, unitPricePaise: -1 }]],
    ['a fractional price', [{ variantId: V1, qty: 1, unitPricePaise: 10.5 }]],
    ['a bad item id', [{ variantId: 'v1', qty: 1, unitPricePaise: 100 }]],
    [
      'the same item twice',
      [
        { variantId: V1, qty: 1, unitPricePaise: 100 },
        { variantId: V1, qty: 1, unitPricePaise: 100 },
      ],
    ],
  ])('refuses %s', (_, lines) => {
    expect(createOrderSchema.safeParse(input(lines)).success).toBe(false);
  });

  it('refuses a missing checkout id', () => {
    expect(
      createOrderSchema.safeParse({ ...input([]), checkoutId: 'x' }).success,
    ).toBe(false);
  });
});

describe('placeOrderResultSchema', () => {
  it('reads a placed order', () => {
    const result = placeOrderResultSchema.parse({
      status: 'placed',
      order_id: 'e0000000-0000-4000-8000-000000000001',
      order_number: 1001,
      subtotal_paise: 1_000_000,
      total_paise: 1_000_000,
      has_price_on_request: false,
      lines: [
        {
          variant_id: V1,
          name: 'Saree',
          options: { size: 'M' },
          qty: 1,
          unit_price_paise: 1_000_000,
        },
      ],
    });
    expect(result.status).toBe('placed');
  });

  it('reads the changed lines', () => {
    const result = placeOrderResultSchema.parse({
      status: 'changed',
      lines: [
        {
          variant_id: V1,
          problems: ['price', 'stock'],
          unit_price_paise: 900,
          available_qty: 1,
        },
      ],
    });
    expect(result.status === 'changed' && result.lines[0]?.problems).toEqual([
      'price',
      'stock',
    ]);
  });

  it('refuses an unknown problem', () => {
    expect(
      placeOrderResultSchema.safeParse({
        status: 'changed',
        lines: [
          {
            variant_id: V1,
            problems: ['odd'],
            unit_price_paise: 1,
            available_qty: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
