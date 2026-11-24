import { cn } from 'cn';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STORE_PAGE_SIZE, type AdminStoreRow } from '@/features/admin/queries';
import {
  storeListHref,
  TENANT_STATUS_LABEL,
  TENANT_STATUSES,
  type StoreListFilter,
} from '@/features/admin/store-list';
import { StoreStatusBadge } from './store-status-badge';

const TABS: { status: StoreListFilter['status']; label: string }[] = [
  { status: 'all', label: 'All' },
  ...TENANT_STATUSES.map((status) => ({
    status,
    label: TENANT_STATUS_LABEL[status],
  })),
  { status: 'overdue', label: 'Overdue' },
];

/** Every store on the platform: status tabs, search, rows and page links. */
export function StoreList({
  stores,
  total,
  filter,
}: {
  stores: AdminStoreRow[];
  total: number;
  filter: StoreListFilter;
}) {
  const pages = Math.ceil(total / STORE_PAGE_SIZE);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Stores"
        description="Every store on the platform."
        actions={
          <Link href="/admin/tenants/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New store
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Store status"
          className="-mx-1 flex gap-1 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const active = filter.status === tab.status;
            return (
              <Link
                key={tab.status}
                href={storeListHref({
                  status: tab.status,
                  search: filter.search,
                })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form role="search" className="relative sm:w-64">
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
            placeholder="Name or address"
            aria-label="Search stores"
            className="pl-8"
          />
        </form>
      </div>

      {stores.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          No stores match.{' '}
          <Link href="/admin" className="underline underline-offset-4">
            Show all stores
          </Link>
        </p>
      ) : (
        <ul
          className="divide-y overflow-hidden rounded-xl border"
          aria-label="Stores"
          data-testid="all-stores"
        >
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/admin/tenants/${store.id}`}
                className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {store.name}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {store.slug} · {store.planName ?? 'No plan'}
                  </span>
                </span>
                {store.overdue && <Badge variant="destructive">Overdue</Badge>}
                <StoreStatusBadge status={store.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {filter.page > 1 && (
            <Link
              href={storeListHref({ ...filter, page: filter.page - 1 })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {filter.page} of {pages}
          </span>
          {filter.page < pages && (
            <Link
              href={storeListHref({ ...filter, page: filter.page + 1 })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
