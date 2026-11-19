'use client';

import { ShoppingBag } from 'lucide-react';
import { summarizeCart } from '@/features/cart/cart';
import {
  useCartDrawer,
  useCartHydrated,
  useCartLines,
} from '@/features/cart/store';
import { cn } from '@/lib/utils';
import { useStore } from './store-provider';

export function CartButton({ className }: { className?: string }) {
  const store = useStore();
  const lines = useCartLines(store.id);
  const hydrated = useCartHydrated();
  const setOpen = useCartDrawer((s) => s.setOpen);
  const count = hydrated ? summarizeCart(lines).itemCount : 0;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'relative grid size-11 place-items-center rounded-full transition-colors hover:bg-store-subtle',
        className,
      )}
      aria-label={count > 0 ? `Open bag, ${count} items` : 'Open bag'}
      data-testid="cart-button"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1 right-0.5 grid min-w-4.5 place-items-center rounded-full bg-store-primary px-1 text-[10px] leading-4.5 font-semibold text-store-on-primary tabular-nums"
          data-testid="cart-count"
        >
          {count}
        </span>
      )}
    </button>
  );
}
