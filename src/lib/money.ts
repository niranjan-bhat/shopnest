/**
 * Money helpers. All amounts are integer paise (₹1 = 100 paise), stored in
 * Postgres as `bigint`. Never use floats for money: format and parse through
 * these helpers only.
 */

/** An integer amount in paise. */
export type Paise = number;

const PAISE_PER_RUPEE = 100;

export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertPaise(value: unknown, label = 'amount'): Paise {
  if (!isPaise(value)) {
    throw new TypeError(`${label} must be an integer number of paise`);
  }
  return value;
}

const wholeRupeeFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const withPaiseFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Exact decimal string for an amount, e.g. 12345 → "123.45". */
function toDecimalString(paise: Paise): `${number}` {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / PAISE_PER_RUPEE);
  const rest = abs % PAISE_PER_RUPEE;
  return `${sign}${rupees}.${String(rest).padStart(2, '0')}` as `${number}`;
}

/**
 * Formats paise as Indian rupees with Indian digit grouping.
 * Whole-rupee amounts drop the decimals unless `alwaysShowPaise` is set:
 * 12345600 → "₹1,23,456", 12345650 → "₹1,23,456.50".
 */
export function formatINR(
  paise: Paise,
  { alwaysShowPaise = false }: { alwaysShowPaise?: boolean } = {},
): string {
  assertPaise(paise);
  const formatter =
    alwaysShowPaise || paise % PAISE_PER_RUPEE !== 0
      ? withPaiseFormat
      : wholeRupeeFormat;
  return formatter.format(toDecimalString(paise));
}

/**
 * Parses a rupee amount typed by a person ("1,23,456.5", "₹ 499") into paise.
 * Returns null for anything that is not a non-negative amount with at most two
 * decimal places.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, rupees, fraction = ''] = match;
  const paise =
    Number(rupees) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

/**
 * Paise as a plain rupee amount for a form field, the inverse of
 * parseRupees: 249900 → "2499", 249950 → "2499.50". No symbol or grouping.
 */
export function toRupeesInput(paise: Paise): string {
  assertPaise(paise);
  const decimal = toDecimalString(paise);
  return paise % PAISE_PER_RUPEE === 0 ? decimal.slice(0, -3) : decimal;
}

/** Unit price × quantity, rejecting non-integer quantities. */
export function lineTotal(unitPaise: Paise, qty: number): Paise {
  assertPaise(unitPaise, 'unit price');
  if (!Number.isSafeInteger(qty) || qty < 0) {
    throw new RangeError('quantity must be a non-negative integer');
  }
  return assertPaise(unitPaise * qty, 'line total');
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  return assertPaise(
    amounts.reduce((total, amount) => total + assertPaise(amount), 0),
    'total',
  );
}
