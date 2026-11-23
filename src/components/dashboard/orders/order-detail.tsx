import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardOrder } from '@/features/orders/dashboard';
import { waLink } from '@/lib/whatsapp';
import { OrderActions } from './order-actions';
import { orderDate } from './order-list';
import { OrderNotes } from './order-notes';
import { OrderLines } from './order-prices';
import { OrderStatusBadge } from './status-badge';

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** "+919876543210" as "+91 98765 43210". */
function formatPhone(phone: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/** One order: its lines and total, status moves, customer and notes. */
export function OrderDetail({
  order,
  storeName,
}: {
  order: DashboardOrder;
  storeName: string;
}) {
  const { customer } = order;
  const needsPrices = order.lines.some((l) => l.unitPricePaise === null);
  const chat = waLink(
    customer.phone,
    `Hello ${customer.name}, this is ${storeName} about your order #${order.number}.`,
  );
  const address = [
    customer.address.line1,
    customer.address.line2,
    `${customer.address.city}, ${customer.address.state} ${customer.address.pincode}`,
  ].filter((line) => line.trim());

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link
          href="/dashboard/orders"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Order #{order.number}
          </h1>
          <span data-testid="order-status-badge">
            <OrderStatusBadge status={order.status} />
          </span>
        </div>
        <p className="text-muted-foreground">
          Placed {orderDate.format(new Date(order.createdAt))} on your store,
          sent on WhatsApp.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          <Section title="Items" testId="order-items">
            <OrderLines
              // Saved prices restart the fields from the saved values.
              key={order.updatedAt}
              orderId={order.id}
              lines={order.lines}
              editable={order.status === 'pending'}
            />
          </Section>
          <Section title="Your notes">
            <OrderNotes orderId={order.id} initial={order.staffNotes} />
          </Section>
        </div>

        {/* On phones, status and customer come first: that is where the
            next step is. */}
        <div className="order-first grid gap-6 lg:order-none">
          <Section title="Status" testId="order-status-card">
            <OrderActions
              orderId={order.id}
              status={order.status}
              needsPrices={needsPrices}
            />
          </Section>
          <Section title="Customer" testId="order-customer">
            <div className="grid gap-4 text-sm">
              <div>
                <p className="font-medium">{customer.name}</p>
                <a
                  href={`tel:${customer.phone}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Phone aria-hidden className="size-3.5" />
                  {formatPhone(customer.phone)}
                </a>
              </div>
              <a
                href={chat}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'outline' })}
              >
                <MessageCircle aria-hidden />
                Chat on WhatsApp
              </a>
              <div>
                <p className="font-medium">Delivery address</p>
                <address className="mt-1 text-muted-foreground not-italic">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
              {customer.note && (
                <div>
                  <p className="font-medium">Their note</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {customer.note}
                  </p>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
