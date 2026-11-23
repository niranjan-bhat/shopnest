'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  setOrderStatus,
  type ShortLine,
} from '@/features/orders/dashboard-actions';
import {
  holdsStock,
  MOVE_LABEL,
  NEXT_STATUSES,
  STATUS_LABEL,
  type OrderStatus,
} from '@/features/orders/status';
import { useHydrated } from '@/lib/use-hydrated';

/** What the merchant does next, for each status. */
const GUIDANCE: Record<OrderStatus, string> = {
  pending:
    'Agree the total and delivery with the customer on WhatsApp, then confirm. Confirming takes the items out of stock.',
  confirmed: 'The items are out of stock and set aside. Pack the order next.',
  packed: 'Packed and ready. Mark it as shipped when it leaves.',
  shipped: 'On its way to the customer.',
  delivered: 'Delivered. Nothing more to do.',
  cancelled: 'Cancelled. Any stock it held has been returned.',
};

/** The order's status, what to do next, and the buttons that move it. */
export function OrderActions({
  orderId,
  status,
  needsPrices,
}: {
  orderId: string;
  status: OrderStatus;
  /** Price-on-request lines still without a price: confirm waits. */
  needsPrices: boolean;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [short, setShort] = useState<ShortLine[] | null>(null);
  const forward = NEXT_STATUSES[status].filter((s) => s !== 'cancelled');
  const canCancel = NEXT_STATUSES[status].includes('cancelled');

  const move = (next: OrderStatus) =>
    startTransition(async () => {
      try {
        const result = await setOrderStatus(orderId, next);
        if (!result.ok) {
          setShort(result.short ?? null);
          toast.error(result.error);
          return;
        }
        setShort(null);
        setCancelling(false);
        toast.success(
          next === 'cancelled'
            ? 'Order cancelled'
            : `Order marked as ${STATUS_LABEL[next].toLowerCase()}`,
        );
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <div
      className="grid gap-4"
      data-testid="order-actions"
      data-hydrated={hydrated || undefined}
    >
      <p className="text-sm text-muted-foreground">{GUIDANCE[status]}</p>

      {needsPrices && forward.includes('confirmed') && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Enter the agreed price for each item priced on request before you
          confirm.
        </p>
      )}

      {short && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="short-stock"
        >
          <p className="font-medium">Not enough stock to confirm</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {short.map((line, i) => (
              <li key={i}>
                {line.name}
                {line.optionsLabel && ` (${line.optionsLabel})`}: ordered{' '}
                {line.qty}, {line.available} in stock
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Update the stock on the product if you have more, or agree a change
            with the customer.
          </p>
        </div>
      )}

      {(forward.length > 0 || canCancel) && (
        <div className="flex flex-wrap gap-2">
          {forward.map((next) => (
            <Button
              key={next}
              type="button"
              onClick={() => move(next)}
              disabled={pending || (next === 'confirmed' && needsPrices)}
            >
              {MOVE_LABEL[next]}
            </Button>
          ))}
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelling(true)}
              disabled={pending}
            >
              {MOVE_LABEL.cancelled}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={cancelling} onOpenChange={setCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {holdsStock(status) ? 'Its items go back into stock. ' : ''}A
              cancelled order cannot be reopened. Let the customer know on
              WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => move('cancelled')}
              disabled={pending}
            >
              {pending ? 'Cancelling…' : 'Cancel order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
