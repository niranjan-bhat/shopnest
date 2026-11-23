'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DashboardOrderLine } from '@/features/orders/dashboard';
import { saveOrderPrices } from '@/features/orders/dashboard-actions';
import { stockNote } from '@/features/orders/status';
import {
  formatINR,
  lineTotal,
  parseRupees,
  toRupeesInput,
  type Paise,
} from '@/lib/money';

function LineName({
  line,
  showStock,
}: {
  line: DashboardOrderLine;
  showStock: boolean;
}) {
  const note = showStock ? stockNote(line.stock, line.qty) : null;
  return (
    <span className="min-w-0">
      <span className="font-medium">{line.name}</span>
      {line.optionsLabel && (
        <span className="text-muted-foreground"> · {line.optionsLabel}</span>
      )}
      <span className="text-muted-foreground"> × {line.qty}</span>
      {note && (
        <span
          className={
            note.short
              ? 'block text-xs font-medium text-destructive'
              : 'block text-xs text-muted-foreground'
          }
          data-testid="line-stock"
        >
          {note.text}
        </span>
      )}
    </span>
  );
}

/**
 * The order's lines and total. While the order is pending, each line shows
 * the item's stock now (so a shortage is seen before the merchant agrees
 * the order), and lines that were priced on request get a price field for
 * the amount agreed with the customer; the total updates as it is typed.
 */
export function OrderLines({
  orderId,
  lines,
  editable,
}: {
  orderId: string;
  lines: DashboardOrderLine[];
  /** Pending orders: price-on-request lines can be priced. */
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines
        .filter((l) => l.priceOnRequest)
        .map((l) => [
          l.id,
          l.unitPricePaise === null ? '' : toRupeesInput(l.unitPricePaise),
        ]),
    ),
  );

  const editing = editable && lines.some((l) => l.priceOnRequest);
  // The price each line has now: typed, or as saved.
  const priceOf = (line: DashboardOrderLine): Paise | null | 'invalid' => {
    if (!editing || !line.priceOnRequest) return line.unitPricePaise;
    const text = inputs[line.id]?.trim() ?? '';
    if (!text) return null;
    return parseRupees(text) ?? 'invalid';
  };
  const prices = lines.map(priceOf);
  const invalid = prices.some((p) => p === 'invalid');
  const total = prices.reduce<number>(
    (sum, p, i) =>
      typeof p === 'number' ? sum + lineTotal(p, lines[i]!.qty) : sum,
    0,
  );
  const unpriced = prices.filter((p) => p === null).length;
  const dirty =
    editing &&
    lines.some(
      (line, i) => line.priceOnRequest && prices[i] !== line.unitPricePaise,
    );

  const save = () =>
    startTransition(async () => {
      try {
        const result = await saveOrderPrices(
          orderId,
          lines
            .map((line, i) => ({ line, price: prices[i] }))
            .filter(({ line }) => line.priceOnRequest)
            .map(({ line, price }) => ({
              itemId: line.id,
              unitPricePaise: typeof price === 'number' ? price : null,
            })),
        );
        if (result.ok) toast.success('Prices saved');
        else toast.error(result.error ?? 'Could not save the prices.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <div className="grid gap-4">
      <ul className="divide-y rounded-lg border" aria-label="Items">
        {lines.map((line, i) => {
          const price = prices[i];
          return (
            <li
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
              data-testid="order-item"
            >
              <LineName line={line} showStock={editable} />
              {editing && line.priceOnRequest ? (
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Agreed price ₹</span>
                  <Input
                    value={inputs[line.id] ?? ''}
                    onChange={(e) =>
                      setInputs((all) => ({
                        ...all,
                        [line.id]: e.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="each"
                    aria-label={`Agreed price for ${line.name}, each`}
                    aria-invalid={price === 'invalid'}
                    className="w-28 text-right tabular-nums"
                  />
                </label>
              ) : (
                <span className="tabular-nums">
                  {price === null || price === 'invalid'
                    ? 'Price on request'
                    : formatINR(lineTotal(price, line.qty))}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between">
        <span className="font-medium">Total</span>
        <span
          className="text-lg font-semibold tabular-nums"
          data-testid="order-total"
        >
          {formatINR(total)}
          {unpriced > 0 && (
            <span className="ml-1 text-sm font-normal text-amber-700 dark:text-amber-400">
              + {unpriced} to agree
            </span>
          )}
        </span>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {invalid && (
            <p className="text-sm text-destructive">
              Enter prices like 45000 or 45,000.50.
            </p>
          )}
          <Button
            type="button"
            onClick={save}
            disabled={pending || invalid || !dirty}
          >
            {pending ? 'Saving…' : 'Save prices'}
          </Button>
        </div>
      )}
    </div>
  );
}
