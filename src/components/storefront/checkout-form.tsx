'use client';

import Link from 'next/link';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircle } from 'lucide-react';
import { summarizeCart } from '@/features/cart/cart';
import {
  useCartHydrated,
  useCartLines,
  useCartStore,
} from '@/features/cart/store';
import {
  checkoutSchema,
  formatAddress,
  INDIAN_STATES,
  type CheckoutInput,
  type CheckoutValues,
} from '@/features/checkout/schema';
import { formatINR, lineTotal } from '@/lib/money';
import { buildOrderMessage, waLink } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { storeHref, storePaths } from './links';
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

/**
 * WhatsApp checkout: collects delivery details, then opens WhatsApp with the
 * order written out for the store. Phase 4 adds a saved order record first.
 */
export function CheckoutForm() {
  const store = useStore();
  const lines = useCartLines(store.id);
  const hydrated = useCartHydrated();
  const clear = useCartStore((s) => s.clear);
  const [sentLink, setSentLink] = useState<string | null>(null);
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

  const onSubmit = (values: CheckoutValues) => {
    const message = buildOrderMessage({
      storeName: store.name,
      lines,
      subtotalPaise: summary.subtotalPaise,
      hasPriceOnRequest: summary.hasPriceOnRequest,
      customer: {
        name: values.name,
        phone: `+91 ${values.phone}`,
        address: formatAddress(values),
        notes: values.notes || undefined,
      },
    });
    const link = waLink(store.whatsappNumber, message);
    setSentLink(link);
    clear(store.id);
    window.location.assign(link);
  };

  if (sentLink) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center" role="status">
        <MessageCircle
          className="mx-auto size-10 text-store-primary"
          aria-hidden
        />
        <h2 className="mt-4 font-store-heading text-3xl">Opening WhatsApp…</h2>
        <p className="mt-3 text-store-muted">
          Your order is written out for {store.name}. Press send in WhatsApp to
          place it; the store will confirm the total and delivery there.
        </p>
        <a
          href={sentLink}
          className="mt-8 inline-block rounded-store bg-store-primary px-8 py-3.5 text-sm font-medium tracking-wide text-store-on-primary uppercase"
        >
          WhatsApp didn&apos;t open? Tap here
        </a>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-store bg-store-subtle" />;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-store bg-store-primary py-4 text-sm font-medium tracking-wide text-store-on-primary uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <MessageCircle className="size-4" aria-hidden />
          Place order on WhatsApp
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
