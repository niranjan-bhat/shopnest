'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircle } from 'lucide-react';
import {
  applyChanges,
  summarizeCart,
  type CartNotice,
} from '@/features/cart/cart';
import {
  useCartHydrated,
  useCartLines,
  useCartStore,
} from '@/features/cart/store';
import {
  checkoutSchema,
  INDIAN_STATES,
  type CheckoutInput,
  type CheckoutValues,
} from '@/features/checkout/schema';
import { createOrder } from '@/features/orders/actions';
import { formatINR, lineTotal, type Paise } from '@/lib/money';
import { cn } from '@/lib/utils';
import { storeHref, storePaths } from './links';
import { rememberOrderMessage } from './send-order-button';
import { useStore } from './store-provider';

const inputClass =
  'border-store-border rounded-store w-full border bg-transparent px-3.5 py-3 text-base outline-none transition-colors placeholder:text-store-muted/70 focus:border-store-primary focus:ring-1 focus:ring-store-primary aria-invalid:border-red-700';

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-store-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Props that wire an input to its error message for screen readers. */
function a11y(id: string, error?: string): ComponentProps<'input'> {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  };
}

const TRY_AGAIN = 'Something went wrong placing your order. Please try again.';

const price = (paise: Paise | null) =>
  paise === null ? 'price on request' : formatINR(paise);

/** What changed since the shopper added items, before they confirm. */
function ChangeNotice({ notices }: { notices: CartNotice[] }) {
  return (
    <div
      role="alert"
      className="rounded-store border border-store-primary/40 bg-store-subtle p-5 text-sm"
      data-testid="order-changes"
    >
      <p className="font-medium">Some items changed since you added them</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        {notices.map((notice, i) => {
          const item = notice.optionsLabel
            ? `${notice.name} (${notice.optionsLabel})`
            : notice.name;
          if (notice.kind === 'removed') {
            return (
              <li key={i}>
                {item} is no longer available and was removed from your bag.
              </li>
            );
          }
          const parts = [
            notice.price &&
              `was ${price(notice.price.was)}, now ${price(notice.price.now)}`,
            notice.qty &&
              `only ${notice.qty.now} left, so your quantity is now ${notice.qty.now}`,
          ].filter(Boolean);
          return <li key={i}>{`${item}: ${parts.join('; ')}.`}</li>;
        })}
      </ul>
      <p className="mt-3 text-store-muted">
        Check the new total, then confirm to place your order.
      </p>
    </div>
  );
}

/**
 * WhatsApp checkout: collects delivery details and saves the order, priced
 * by the server. If prices or stock changed since the shopper added items,
 * the bag is updated and the shopper confirms before anything is saved.
 * Then the confirmation page opens WhatsApp with the order written out.
 */
export function CheckoutForm() {
  const store = useStore();
  const router = useRouter();
  const lines = useCartLines(store.id);
  const hydrated = useCartHydrated();
  const clear = useCartStore((s) => s.clear);
  const replace = useCartStore((s) => s.replace);
  // One id per checkout: a double click or retry returns the same order.
  const [checkoutId] = useState(() => crypto.randomUUID());
  const [notices, setNotices] = useState<CartNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const summary = summarizeCart(lines);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      pincode: '',
      notes: '',
    },
  });

  const onSubmit = async (values: CheckoutValues) => {
    setError(null);
    let result: Awaited<ReturnType<typeof createOrder>>;
    try {
      result = await createOrder({
        checkoutId,
        customer: values,
        lines: lines.map((line) => ({
          variantId: line.variantId,
          qty: line.qty,
          unitPricePaise: line.unitPricePaise,
        })),
      });
    } catch {
      setError(TRY_AGAIN);
      return;
    }
    if (result.status === 'error') {
      setError(result.error);
      return;
    }
    if (result.status === 'changed') {
      const applied = applyChanges(lines, result.changes);
      replace(store.id, applied.lines);
      setNotices(applied.notices);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    rememberOrderMessage(result.orderId, result.whatsappUrl);
    setPlaced(true);
    router.push(storeHref(store.basePath, storePaths.order(result.orderId)));
    clear(store.id);
  };

  if (placed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center" role="status">
        <MessageCircle
          className="mx-auto size-10 text-store-primary"
          aria-hidden
        />
        <h2 className="mt-4 font-store-heading text-3xl">Order saved</h2>
        <p className="mt-3 text-store-muted">
          Opening your order for {store.name}…
        </p>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-store bg-store-subtle" />;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        {notices.length > 0 && (
          <div className="mx-auto mb-8 max-w-lg text-left">
            <ChangeNotice notices={notices} />
          </div>
        )}
        <p className="text-lg text-store-muted">Your bag is empty.</p>
        <Link
          href={storeHref(store.basePath, storePaths.home)}
          className="mt-4 inline-block text-store-primary underline underline-offset-4"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-8"
        aria-label="Delivery details"
      >
        {notices.length > 0 && <ChangeNotice notices={notices} />}
        <fieldset className="space-y-5">
          <legend className="mb-4 font-store-heading text-2xl">Contact</legend>
          <Field id="name" label="Full name" error={errors.name?.message}>
            <input
              {...register('name')}
              {...a11y('name', errors.name?.message)}
              autoComplete="name"
              className={inputClass}
            />
          </Field>
          <Field
            id="phone"
            label="Mobile number"
            error={errors.phone?.message}
            hint="The store will contact you on this number."
          >
            <div className="flex">
              <span className="grid place-items-center rounded-l-store border border-r-0 border-store-border px-3 text-store-muted">
                +91
              </span>
              <input
                {...register('phone')}
                {...a11y('phone', errors.phone?.message)}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className={cn(inputClass, 'rounded-l-none')}
              />
            </div>
          </Field>
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="mb-4 font-store-heading text-2xl">Delivery</legend>
          <Field
            id="addressLine1"
            label="Address"
            error={errors.addressLine1?.message}
          >
            <input
              {...register('addressLine1')}
              {...a11y('addressLine1', errors.addressLine1?.message)}
              autoComplete="address-line1"
              placeholder="House no., building, street"
              className={inputClass}
            />
          </Field>
          <Field
            id="addressLine2"
            label="Area or landmark (optional)"
            error={errors.addressLine2?.message}
          >
            <input
              {...register('addressLine2')}
              {...a11y('addressLine2', errors.addressLine2?.message)}
              autoComplete="address-line2"
              className={inputClass}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="city" label="City" error={errors.city?.message}>
              <input
                {...register('city')}
                {...a11y('city', errors.city?.message)}
                autoComplete="address-level2"
                className={inputClass}
              />
            </Field>
            <Field
              id="pincode"
              label="PIN code"
              error={errors.pincode?.message}
            >
              <input
                {...register('pincode')}
                {...a11y('pincode', errors.pincode?.message)}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                className={inputClass}
              />
            </Field>
          </div>
          <Field id="state" label="State" error={errors.state?.message}>
            <select
              {...register('state')}
              id="state"
              aria-invalid={errors.state ? true : undefined}
              aria-describedby={errors.state ? 'state-error' : undefined}
              autoComplete="address-level1"
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Choose a state
              </option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="notes"
            label="Notes for the store (optional)"
            error={errors.notes?.message}
          >
            <textarea
              {...register('notes')}
              id="notes"
              rows={3}
              placeholder="Blouse stitching, gift wrap, delivery timing…"
              className={inputClass}
            />
          </Field>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-store bg-store-primary py-4 text-sm font-medium tracking-wide text-store-on-primary uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <MessageCircle className="size-4" aria-hidden />
          {isSubmitting
            ? 'Placing your order…'
            : notices.some((n) => n.kind === 'changed' && n.price)
              ? 'Confirm new prices and place order'
              : notices.length > 0
                ? 'Confirm changes and place order'
                : 'Place order on WhatsApp'}
        </button>
        <p className="text-center text-sm text-store-muted">
          WhatsApp opens with your order written out. Nothing is charged now;{' '}
          {store.name} confirms the total and delivery with you.
        </p>
      </form>

      <aside className="h-fit rounded-store bg-store-subtle p-6 lg:sticky lg:top-28">
        <h2 className="font-store-heading text-2xl">Your order</h2>
        <ul className="mt-4 divide-y divide-store-border text-sm">
          {lines.map((line) => (
            <li
              key={line.variantId}
              className="flex justify-between gap-4 py-3"
            >
              <span>
                {line.name}
                {line.optionsLabel && (
                  <span className="text-store-muted">
                    {' '}
                    · {line.optionsLabel}
                  </span>
                )}
                <span className="text-store-muted"> × {line.qty}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {line.unitPricePaise === null
                  ? 'On request'
                  : formatINR(lineTotal(line.unitPricePaise, line.qty))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-store-border pt-4">
          <span>Subtotal</span>
          <span className="text-lg tabular-nums">
            {formatINR(summary.subtotalPaise)}
          </span>
        </div>
        {summary.hasPriceOnRequest && (
          <p className="mt-2 text-sm text-store-muted">
            + items priced on request (total to be confirmed)
          </p>
        )}
      </aside>
    </div>
  );
}
