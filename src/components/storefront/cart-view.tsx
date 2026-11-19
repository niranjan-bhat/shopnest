'use client';

import Link from 'next/link';
import { summarizeCart } from '@/features/cart/cart';
import { useCartHydrated, useCartLines } from '@/features/cart/store';
import { formatINR } from '@/lib/money';
import { CartLineItem } from './cart-line-item';
import { storeHref, storePaths } from './links';
import { useStore } from './store-provider';

/** Full cart page content. */
export function CartView() {
  const store = useStore();
  const lines = useCartLines(store.id);
  const hydrated = useCartHydrated();
  const summary = summarizeCart(lines);

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-store bg-store-subtle" />;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-store-muted">Your bag is empty.</p>
        <Link
          href={storeHref(store.basePath, storePaths.home)}
          className="mt-6 inline-block rounded-store bg-store-primary px-8 py-3.5 text-sm font-medium tracking-wide text-store-on-primary uppercase"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
      <ul className="divide-y divide-store-border border-y border-store-border">
        {lines.map((line) => (
          <CartLineItem key={line.variantId} line={line} />
        ))}
      </ul>
      <aside className="h-fit space-y-4 rounded-store bg-store-subtle p-6 lg:sticky lg:top-28">
        <h2 className="font-store-heading text-2xl">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd className="tabular-nums">{summary.itemCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd className="text-store-muted">Confirmed on WhatsApp</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-store-border pt-3 text-base">
            <dt>Subtotal</dt>
            <dd className="text-lg tabular-nums" data-testid="cart-subtotal">
              {formatINR(summary.subtotalPaise)}
            </dd>
          </div>
        </dl>
        {summary.hasPriceOnRequest && (
          <p className="text-sm text-store-muted">
            Includes items priced on request. The store will confirm the final
            total with you on WhatsApp.
          </p>
        )}
        <Link
          href={storeHref(store.basePath, storePaths.checkout)}
          className="block rounded-store bg-store-primary py-3.5 text-center text-sm font-medium tracking-wide text-store-on-primary uppercase transition-opacity hover:opacity-90"
        >
          Checkout on WhatsApp
        </Link>
      </aside>
    </div>
  );
}
