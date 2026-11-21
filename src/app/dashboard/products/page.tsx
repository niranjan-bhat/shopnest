import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductList } from '@/components/dashboard/products/product-list';
import { Skeleton } from '@/components/ui/skeleton';
import {
  countDashboardProducts,
  listDashboardProducts,
} from '@/features/catalog/dashboard';
import { parseProductListFilter } from '@/features/catalog/product-schema';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Products' };

type Props = PageProps<'/dashboard/products'>;

async function Products({ searchParams }: Pick<Props, 'searchParams'>) {
  const { store } = await requireStore('/dashboard/products');
  const filter = parseProductListFilter(await searchParams);
  const [products, counts] = await Promise.all([
    listDashboardProducts(store.id, filter),
    countDashboardProducts(store.id),
  ]);
  return <ProductList products={products} counts={counts} filter={filter} />;
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="grid gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}
