import { describe, expect, it } from 'vitest';
import {
  assertPaise,
  formatINR,
  lineTotal,
  parseRupees,
  toRupeesInput,
  sumPaise,
} from './money';

describe('formatINR', () => {
  it('uses Indian digit grouping and hides zero paise', () => {
    expect(formatINR(12_345_600)).toBe('₹1,23,456');
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(99_900)).toBe('₹999');
  });

  it('shows paise when present or requested', () => {
    expect(formatINR(12_345_650)).toBe('₹1,23,456.50');
    expect(formatINR(5)).toBe('₹0.05');
    expect(formatINR(50_000, { alwaysShowPaise: true })).toBe('₹500.00');
  });

  it('formats negative amounts', () => {
    expect(formatINR(-25_000)).toBe('-₹250');
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatINR(10.5)).toThrow(TypeError);
  });
});

describe('parseRupees', () => {
  it.each([
    ['499', 49_900],
    ['₹ 1,23,456.5', 12_345_650],
    ['Rs. 10.05', 1_005],
    ['0.1', 10],
    ['  2,999  ', 299_900],
  ])('parses %j as %i paise', (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '1e3', '12.', '.5'])(
    'rejects %j',
    (input) => {
      expect(parseRupees(input)).toBeNull();
    },
  );
});

describe('toRupeesInput', () => {
  it.each([
    [249900, '2499'],
    [249950, '2499.50'],
    [5, '0.05'],
    [0, '0'],
  ])('%i paise → %s', (paise, text) => {
    expect(toRupeesInput(paise)).toBe(text);
    expect(parseRupees(text)).toBe(paise);
  });
});

describe('arithmetic', () => {
  it('computes line totals and sums', () => {
    expect(lineTotal(129_900, 3)).toBe(389_700);
    expect(sumPaise([129_900, 49_900, 0])).toBe(179_800);
    expect(sumPaise([])).toBe(0);
  });

  it('rejects fractional quantities and amounts', () => {
    expect(() => lineTotal(100, 1.5)).toThrow(RangeError);
    expect(() => lineTotal(100, -1)).toThrow(RangeError);
    expect(() => sumPaise([1, 0.5])).toThrow(TypeError);
    expect(() => assertPaise('100')).toThrow(TypeError);
  });
});
