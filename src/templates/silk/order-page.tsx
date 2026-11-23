import Link from 'next/link';
import { storeHref, storePaths } from '@/components/storefront/links';
import { SendOrderButton } from '@/components/storefront/send-order-button';
import { formatINR, lineTotal } from '@/lib/money';
import { waLink } from '@/lib/whatsapp';
import type { OrderPageProps } from '../contract';
import { SectionHeading } from './section-heading';

const STATUS_TEXT: Record<OrderPageProps['order']['status'], string> = {
  pending: 'Waiting for the store to confirm',
  confirmed: 'Confirmed by the store',
  packed: 'Packed',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** After checkout: the order number, what was ordered, Send on WhatsApp. */
export function SilkOrderPage({ store, order }: OrderPageProps) {
  const fallbackUrl = waLink(
    store.whatsappNumber,
    `Hello ${store.name}, I placed order #${order.number} on your website.`,
  );
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 md:px-8">
      <SectionHeading
        as="h1"
        title={`Order #${order.number}`}
        subtitle="Thank you. Your order is saved."
        className="mb-10"
      />

      <div className="rounded-store bg-store-subtle p-6 text-center">
        <p className="text-sm text-store-muted" data-testid="order-status">
          {STATUS_TEXT[order.status]}
        </p>
        {order.status === 'pending' && (
          <>
            <p className="mt-3">
              Send it to {store.name} on WhatsApp. They&apos;ll confirm{' '}
              {order.hasPriceOnRequest ? 'the prices, ' : ''}delivery and
              payment with you there. Nothing is charged now.
            </p>
            <SendOrderButton
              orderId={order.id}
              fallbackUrl={fallbackUrl}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-store bg-store-primary px-8 py-4 text-sm font-medium tracking-wide text-store-on-primary uppercase transition-opacity hover:opacity-90"
            />
          </>
        )}
      </div>

      <section aria-labelledby="order-items" className="mt-10">
        <h2 id="order-items" className="font-store-heading text-2xl">
          Your order
        </h2>
        <ul className="mt-4 divide-y divide-store-border border-y border-store-border text-sm">
          {order.lines.map((line, i) => (
            <li
              key={i}
              className="flex justify-between gap-4 py-3"
              data-testid="order-line"
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
        <div className="mt-4 flex items-baseline justify-between">
          <span>Total</span>
          <span className="text-lg tabular-nums" data-testid="order-total">
            {order.hasPriceOnRequest
              ? `${formatINR(order.totalPaise)} + to be confirmed`
              : formatINR(order.totalPaise)}
          </span>
        </div>
        {order.hasPriceOnRequest && (
          <p className="mt-2 text-sm text-store-muted">
            Some items are priced on request. The store confirms the final total
            with you.
          </p>
        )}
      </section>

      <p className="mt-10 text-center">
        <Link
          href={storeHref(store.basePath, storePaths.home)}
          className="text-store-primary underline underline-offset-4"
        >
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
