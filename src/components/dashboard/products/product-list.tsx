import { cn } from 'cn';
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Package,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { StoreImage } from '@/components/storefront/store-image';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  DashboardProduct,
  ProductCounts,
  ProductListFilter,
  ProductPage,
} from '@/features/catalog/dashboard';
import { PRODUCT_PAGE_SIZE } from '@/features/catalog/product-schema';
import { STATUS_BADGE } from './status-badge';
import { formatINR } from '@/lib/money';

const TABS: { status: ProductListFilter['status']; label: string }[] = [
  { status: 'all', label: 'All' },
  { status: 'active', label: 'Active' },
  { status: 'draft', label: 'Draft' },
  { status: 'archived', label: 'Archived' },
];

/** The list's URL; a new tab or search starts again at page 1. */
function listHref(
  filter: Omit<ProductListFilter, 'page'> & { page?: number },
): string {
  const params = new URLSearchParams();
  if (filter.status !== 'all') params.set('status', filter.status);
  if (filter.search) params.set('q', filter.search);
  if (filter.page && filter.page > 1) params.set('page', String(filter.page));
  const query = params.toString();
  return `/dashboard/products${query ? `?${query}` : ''}`;
}

function priceText(product: DashboardProduct): string {
  if (!product.price) return 'Price on request';
  const { min, max } = product.price;
  return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
}

function stockText(product: DashboardProduct): string {
  if (product.stock === null) return 'Not tracked';
  const variants =
    product.variantCount > 1 ? ` · ${product.variantCount} variants` : '';
  return `${product.stock} in stock${variants}`;
}

function Thumbnail({ product }: { product: DashboardProduct }) {
  return (
    <span className="relative block size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {product.image ? (
        <StoreImage image={product.image} sizes="48px" fill alt="" />
      ) : (
        <ImageIcon
          aria-hidden
          className="absolute inset-0 m-auto size-4 text-muted-foreground"
        />
      )}
    </span>
  );
}

const addButton = (
  <Link href="/dashboard/products/new" className={buttonVariants()}>
    <Plus aria-hidden />
    Add product
  </Link>
);

/** Products page: status tabs, search, the product rows and page links. */
export function ProductList({
  page: { products, total },
  counts,
  filter,
}: {
  page: ProductPage;
  counts: ProductCounts;
  filter: ProductListFilter;
}) {
  if (counts.all === 0) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Products"
          description="Everything you sell, with prices, sizes and stock."
        />
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first saree, kurta or lehenga. You can save it as a draft and publish when it is ready."
          action={addButton}
          testId="no-products"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Products"
        description="Everything you sell, with prices, sizes and stock."
        actions={addButton}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Product status"
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
            placeholder="Search products"
            aria-label="Search products"
            className="pl-8"
          />
        </form>
      </div>

      {products.length === 0 && total > 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          This page is empty.{' '}
          <Link
            href={listHref({
              ...filter,
              page: Math.ceil(total / PRODUCT_PAGE_SIZE),
            })}
            className="underline underline-offset-4"
          >
            Go to the last page
          </Link>
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          No products match.{' '}
          <Link
            href={listHref({ status: 'all', search: '' })}
            className="underline underline-offset-4"
          >
            Show all products
          </Link>
        </p>
      ) : (
        <ul
          className="divide-y overflow-hidden rounded-xl border"
          aria-label="Products"
        >
          {products.map((product) => {
            const badge = STATUS_BADGE[product.status];
            return (
              <li key={product.id} data-testid="product-row">
                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="flex items-center gap-3 bg-card px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4"
                >
                  <Thumbnail product={product} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {product.name}
                      </span>
                      {product.isFeatured && (
                        <Star
                          aria-label="Featured"
                          className="size-3.5 shrink-0 fill-amber-400 text-amber-500"
                        />
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[stockText(product), ...product.categories].join(' · ')}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm sm:block">
                    {priceText(product)}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination filter={filter} total={total} shown={products.length} />
    </div>
  );
}

function Pagination({
  filter,
  total,
  shown,
}: {
  filter: ProductListFilter;
  total: number;
  shown: number;
}) {
  const pages = Math.ceil(total / PRODUCT_PAGE_SIZE);
  if (pages <= 1 || shown === 0) return null;
  const first = (filter.page - 1) * PRODUCT_PAGE_SIZE + 1;
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
