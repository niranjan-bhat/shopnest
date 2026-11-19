import { describe, expect, it } from 'vitest';
import {
  addLine,
  clampQty,
  formatOptions,
  MAX_QTY_PER_LINE,
  removeLine,
  setLineQty,
  summarizeCart,
  type CartItemInput,
} from './cart';

const item = (overrides: Partial<CartItemInput> = {}): CartItemInput => ({
  variantId: 'v1',
  productId: 'p1',
  productSlug: 'kurta',
  name: 'Kurta',
  optionsLabel: 'M',
  unitPricePaise: 129_900,
  imageKey: null,
  maxQty: null,
  ...overrides,
});

describe('cart', () => {
  it('adds a line and merges repeat adds of the same variant', () => {
    let lines = addLine([], item(), 1);
    lines = addLine(lines, item(), 2);
    lines = addLine(lines, item({ variantId: 'v2' }), 1);
    expect(lines.map((l) => [l.variantId, l.qty])).toEqual([
      ['v1', 3],
      ['v2', 1],
    ]);
  });

  it('caps quantity at stock and at the per-line maximum', () => {
    expect(addLine([], item({ maxQty: 2 }), 5)[0]?.qty).toBe(2);
    expect(addLine([], item(), 50)[0]?.qty).toBe(MAX_QTY_PER_LINE);
    expect(addLine([], item({ maxQty: 0 }), 1)).toEqual([]);
    expect(clampQty(2.7, null)).toBe(2);
    expect(clampQty(Number.NaN, null)).toBe(1);
  });

  it('updates and removes lines', () => {
    const lines = addLine(addLine([], item()), item({ variantId: 'v2' }));
    expect(setLineQty(lines, 'v1', 4)[0]?.qty).toBe(4);
    expect(setLineQty(lines, 'v1', 0).map((l) => l.variantId)).toEqual(['v2']);
    expect(removeLine(lines, 'v2').map((l) => l.variantId)).toEqual(['v1']);
  });

  it('summarises priced and price-on-request lines', () => {
    const lines = [
      ...addLine([], item(), 2),
      ...addLine([], item({ variantId: 'v2', unitPricePaise: null }), 1),
    ];
    expect(summarizeCart(lines)).toEqual({
      itemCount: 3,
      subtotalPaise: 259_800,
      hasPriceOnRequest: true,
    });
    expect(summarizeCart([])).toEqual({
      itemCount: 0,
      subtotalPaise: 0,
      hasPriceOnRequest: false,
    });
  });

  it('formats variant options', () => {
    expect(formatOptions({ colour: 'Indigo', size: 'M' })).toBe('Indigo · M');
    expect(formatOptions({})).toBe('');
  });
});
