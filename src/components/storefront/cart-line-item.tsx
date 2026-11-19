'use client';

import Link from 'next/link';
import { Trash } from 'lucide-react';
import { MAX_QTY_PER_LINE, type CartLine } from '@/features/cart/cart';
import { useCartStore } from '@/features/cart/store';
import { formatINR, lineTotal } from '@/lib/money';
import { cn } from '@/lib/utils';
import { storeHref, storePaths } from './links';
import { QuantityStepper } from './quantity-stepper';
import { StoreImage } from './store-image';
import { useStore } from './store-provider';

export function CartLineItem({
  line,
  compact = false,
  onNavigate,
}: {
  line: CartLine;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const store = useStore();
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const href = storeHref(store.basePath, storePaths.product(line.productSlug));
  const max = Math.min(MAX_QTY_PER_LINE, line.maxQty ?? MAX_QTY_PER_LINE);

  return (
    <li className="flex gap-4 py-5" data-testid="cart-line">
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          'relative shrink-0 overflow-hidden rounded-store bg-store-subtle',
          compact ? 'h-28 w-21' : 'h-36 w-27',
        )}
      >
        {line.imageKey && (
          <StoreImage
            image={{
              key: line.imageKey,
              alt: line.name,
              width: 900,
              height: 1200,
            }}
            alt=""
            fill
            sizes="120px"
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={href}
              onClick={onNavigate}
              className="line-clamp-2 font-store-heading text-lg leading-snug hover:underline"
            >
              {line.name}
            </Link>
            {line.optionsLabel && (
              <p className="mt-0.5 text-sm text-store-muted">
                {line.optionsLabel}
              </p>
            )}
          </div>
          <p className="shrink-0 text-sm tabular-nums">
            {line.unitPricePaise === null ? (
              <span className="text-store-muted italic">On request</span>
            ) : (
              formatINR(lineTotal(line.unitPricePaise, line.qty))
            )}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <QuantityStepper
            size="sm"
            min={1}
            value={line.qty}
            max={max}
            label={`Quantity of ${line.name}`}
            onChange={(qty) => setQty(store.id, line.variantId, qty)}
          />
          <button
            type="button"
            onClick={() => remove(store.id, line.variantId)}
            className="inline-flex items-center gap-1.5 text-sm text-store-muted underline-offset-4 hover:text-store-text hover:underline"
          >
            <Trash className="size-3.5" aria-hidden />
            Remove
            <span className="sr-only"> {line.name}</span>
          </button>
        </div>
      </div>
    </li>
  );
}
