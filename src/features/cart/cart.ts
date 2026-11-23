import { lineTotal, sumPaise, type Paise } from '@/lib/money';

/** Most units of one variant a shopper can put in the cart. */
export const MAX_QTY_PER_LINE = 10;

/**
 * One cart line. Display fields are a snapshot taken when the item was added;
 * they are only for showing the cart. Phase 4's createOrder re-prices every
 * line from the database, so the client never decides what an order costs.
 */
export type CartLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  /** e.g. "Indigo · M"; empty for products without options. */
  optionsLabel: string;
  /** Paise; null when the price is on request. */
  unitPricePaise: Paise | null;
  imageKey: string | null;
  /** Stock limit when inventory is tracked; null for no limit. */
  maxQty: number | null;
  qty: number;
};

export type CartItemInput = Omit<CartLine, 'qty'>;

export function clampQty(qty: number, maxQty: number | null): number {
  const limit = Math.min(MAX_QTY_PER_LINE, maxQty ?? MAX_QTY_PER_LINE);
  if (!Number.isFinite(qty)) return 1;
  return Math.max(0, Math.min(limit, Math.trunc(qty)));
}

/** Adds an item, merging with an existing line for the same variant. */
export function addLine(
  lines: CartLine[],
  item: CartItemInput,
  qty = 1,
): CartLine[] {
  const existing = lines.find((l) => l.variantId === item.variantId);
  if (!existing) {
    const clamped = clampQty(qty, item.maxQty);
    return clamped > 0 ? [...lines, { ...item, qty: clamped }] : lines;
  }
  return lines.map((l) =>
    l.variantId === item.variantId
      ? { ...l, ...item, qty: clampQty(l.qty + qty, item.maxQty) }
      : l,
  );
}

/** Sets a line's quantity; 0 or less removes it. */
export function setLineQty(
  lines: CartLine[],
  variantId: string,
  qty: number,
): CartLine[] {
  return lines
    .map((l) =>
      l.variantId === variantId ? { ...l, qty: clampQty(qty, l.maxQty) } : l,
    )
    .filter((l) => l.qty > 0);
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export type CartSummary = {
  itemCount: number;
  /** Total of the priced lines only. */
  subtotalPaise: Paise;
  /** True when some line is price-on-request, so the total is not final. */
  hasPriceOnRequest: boolean;
};

export function summarizeCart(lines: CartLine[]): CartSummary {
  return {
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    subtotalPaise: sumPaise(
      lines
        .filter((l) => l.unitPricePaise !== null)
        .map((l) => lineTotal(l.unitPricePaise as Paise, l.qty)),
    ),
    hasPriceOnRequest: lines.some((l) => l.unitPricePaise === null),
  };
}

/** A line the server reported as changed (see features/orders/schema.ts). */
export type ReportedChange = {
  variantId: string;
  problems: ('unavailable' | 'stock' | 'price')[];
  unitPricePaise: Paise | null;
  availableQty: number | null;
};

/** What happened to one line, for the checkout to tell the shopper. */
export type CartNotice =
  | { kind: 'removed'; name: string; optionsLabel: string }
  | {
      kind: 'changed';
      name: string;
      optionsLabel: string;
      /** Set when the price changed. */
      price?: { was: Paise | null; now: Paise | null };
      /** Set when there were fewer left than the shopper wanted. */
      qty?: { was: number; now: number };
    };

/**
 * Brings the cart in line with today's prices and stock: lines no longer for
 * sale (or sold out) are removed, quantities drop to what is left, and
 * prices update. Returns the new lines and a notice for each change.
 */
export function applyChanges(
  lines: CartLine[],
  changes: ReportedChange[],
): { lines: CartLine[]; notices: CartNotice[] } {
  const byVariant = new Map(changes.map((c) => [c.variantId, c]));
  const notices: CartNotice[] = [];
  const next: CartLine[] = [];
  for (const line of lines) {
    const change = byVariant.get(line.variantId);
    if (!change) {
      next.push(line);
      continue;
    }
    const label = { name: line.name, optionsLabel: line.optionsLabel };
    const left = change.availableQty;
    if (change.problems.includes('unavailable') || left === 0) {
      notices.push({ kind: 'removed', ...label });
      continue;
    }
    const updated: CartLine = {
      ...line,
      unitPricePaise: change.unitPricePaise,
      maxQty: left,
      qty: clampQty(line.qty, left),
    };
    notices.push({
      kind: 'changed',
      ...label,
      ...(updated.unitPricePaise !== line.unitPricePaise && {
        price: { was: line.unitPricePaise, now: updated.unitPricePaise },
      }),
      ...(updated.qty !== line.qty && {
        qty: { was: line.qty, now: updated.qty },
      }),
    });
    next.push(updated);
  }
  return { lines: next, notices };
}

/** "Colour: Indigo, Size: M" style label from variant options. */
export function formatOptions(options: Record<string, string>): string {
  return Object.values(options).join(' · ');
}
