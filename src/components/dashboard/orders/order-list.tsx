import { cn } from 'cn';
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ORDER_PAGE_SIZE,
  type OrderCounts,
  type OrderListFilter,
  type OrderPage,
} from '@/features/orders/dashboard';
import { ORDER_STATUSES, STATUS_LABEL } from '@/features/orders/status';
import { formatINR } from '@/lib/money';
import { OrderStatusBadge } from './status-badge';

const TABS: { status: OrderListFilter['status']; label: string }[] = [
  { status: 'all', label: 'All' },
  ...ORDER_STATUSES.map((status) => ({ status, label: STATUS_LABEL[status] })),
];

// Orders are placed in India; show their times there, whatever the server's
// time zone.
export const orderDate = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

const DESCRIPTION =
  'Orders from your store. Confirm each one after you agree it with the customer on WhatsApp.';

/** The list's URL; a new tab or search starts again at page 1. */
function listHref(
  filter: Omit<OrderListFilter, 'page'> & { page?: number },
): string {
  const params = new URLSearchParams();
  if (filter.status !== 'all') params.set('status', filter.status);
  if (filter.search) params.set('q', filter.search);
  if (filter.page && filter.page > 1) params.set('page', String(filter.page));
  const query = params.toString();
  return `/dashboard/orders${query ? `?${query}` : ''}`;
}

/** Orders page: status tabs, search, the order rows and page links. */
export function OrderList({
  page: { orders, total },
  counts,
  filter,
}: {
  page: OrderPage;
  counts: OrderCounts;
  filter: OrderListFilter;
}) {
  if (counts.all === 0) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Orders" description={DESCRIPTION} />
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="When a customer checks out, their order shows up here, and they send it to you on WhatsApp."
          testId="no-orders"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Orders" description={DESCRIPTION} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Order status"
          className="-mx-1 flex gap-1 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const active = filter.status === tab.status;
            return (
              <Link
                key={tab.status}
                href={listHref({ search: filter.search, status: tab.status })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}{' '}
                <span className="text-muted-foreground">
                  {counts[tab.status]}
                </span>
              </Link>
            );
          })}
        </nav>
        <form role="search" className="relative lg:w-64">
          {filter.status !== 'all' && (
            <input type="hidden" name="status" value={filter.status} />
          )}
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name="q"
            defaultValue={filter.search}
            placeholder="Order no., phone or name"
            aria-label="Search orders"
            className="pl-8"
          />
        </form>
      </div>

      {orders.length === 0 && total > 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          This page is empty.{' '}
          <Link
            href={listHref({
              ...filter,
              page: Math.ceil(total / ORDER_PAGE_SIZE),
            })}
            className="underline underline-offset-4"
          >
            Go to the last page
          </Link>
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          No orders match.{' '}
          <Link
            href={listHref({ status: 'all', search: '' })}
            className="underline underline-offset-4"
          >
            Show all orders
          </Link>
        </p>
      ) : (
        <ul
          className="divide-y overflow-hidden rounded-xl border"
          aria-label="Orders"
        >
          {orders.map((order) => (
            <li key={order.id} data-testid="order-row">
              <Link
                href={`/dashboard/orders/${order.id}`}
                className="flex items-center gap-3 bg-card px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      #{order.number}
                    </span>
                    <span className="truncate">{order.customerName}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {orderDate.format(new Date(order.createdAt))} ·{' '}
                    {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  {formatINR(order.totalPaise)}
                  {order.needsPrices && (
                    <span className="block text-xs text-amber-700 dark:text-amber-400">
                      + prices to agree
                    </span>
                  )}
                </span>
                <OrderStatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination filter={filter} total={total} shown={orders.length} />
    </div>
  );
}

function Pagination({
  filter,
  total,
  shown,
}: {
  filter: OrderListFilter;
  total: number;
  shown: number;
}) {
  const pages = Math.ceil(total / ORDER_PAGE_SIZE);
  if (pages <= 1 || shown === 0) return null;
  const first = (filter.page - 1) * ORDER_PAGE_SIZE + 1;
  const last = first + shown - 1;
  const link = (page: number, label: string, icon: 'prev' | 'next') => {
    const disabled = page < 1 || page > pages;
    const content = (
      <>
        {icon === 'prev' && <ChevronLeft aria-hidden />}
        {label}
        {icon === 'next' && <ChevronRight aria-hidden />}
      </>
    );
    const className = buttonVariants({ variant: 'outline', size: 'sm' });
    return disabled ? (
      <span aria-disabled="true" className={cn(className, 'opacity-50')}>
        {content}
      </span>
    ) : (
      <Link href={listHref({ ...filter, page })} className={className}>
        {content}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground" data-testid="page-summary">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        {link(filter.page - 1, 'Previous', 'prev')}
        <span className="text-sm text-muted-foreground">
          Page {filter.page} of {pages}
        </span>
        {link(filter.page + 1, 'Next', 'next')}
      </div>
    </nav>
  );
}
