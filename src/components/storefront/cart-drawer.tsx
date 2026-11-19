'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { summarizeCart } from '@/features/cart/cart';
import { useCartDrawer, useCartLines } from '@/features/cart/store';
import { formatINR } from '@/lib/money';
import { CartLineItem } from './cart-line-item';
import { storeHref, storePaths } from './links';
import { useStore } from './store-provider';

/** Slide-in cart, opened by the header cart button and after adding an item. */
export function CartDrawer() {
  const store = useStore();
  const lines = useCartLines(store.id);
  const { open, setOpen } = useCartDrawer();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const summary = summarizeCart(lines);
  const close = () => setOpen(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close when the route changes (e.g. a link inside the drawer).
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-drawer-title"
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-store-bg p-0 font-store-body text-store-text shadow-2xl backdrop:bg-black/45 open:animate-in open:slide-in-from-right"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-store-border px-6 py-5">
          <h2 id="cart-drawer-title" className="font-store-heading text-2xl">
            Your bag
            {summary.itemCount > 0 && (
              <span className="ml-2 text-base text-store-muted">
                ({summary.itemCount})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={close}
            className="-mr-2 grid size-10 place-items-center rounded-full hover:bg-store-subtle"
            aria-label="Close bag"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="size-10 text-store-muted" aria-hidden />
            <p className="text-store-muted">Your bag is empty.</p>
            <button
              type="button"
              onClick={close}
              className="text-store-primary underline underline-offset-4"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-store-border overflow-y-auto px-6">
              {lines.map((line) => (
                <CartLineItem
                  key={line.variantId}
                  line={line}
                  compact
                  onNavigate={close}
                />
              ))}
            </ul>
            <footer className="space-y-4 border-t border-store-border px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span>Subtotal</span>
                <span className="text-lg tabular-nums">
                  {formatINR(summary.subtotalPaise)}
                </span>
              </div>
              <p className="text-sm text-store-muted">
                {summary.hasPriceOnRequest
                  ? 'Some items are priced on request; the store confirms the final total on WhatsApp.'
                  : 'Shipping is confirmed by the store on WhatsApp.'}
              </p>
              <div className="grid gap-2">
                <Link
                  href={storeHref(store.basePath, storePaths.checkout)}
                  onClick={close}
                  className="block rounded-store bg-store-primary py-3.5 text-center text-sm font-medium tracking-wide text-store-on-primary uppercase transition-opacity hover:opacity-90"
                >
                  Checkout
                </Link>
                <Link
                  href={storeHref(store.basePath, storePaths.cart)}
                  onClick={close}
                  className="block rounded-store border border-store-border py-3 text-center text-sm hover:bg-store-subtle"
                >
                  View bag
                </Link>
              </div>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
