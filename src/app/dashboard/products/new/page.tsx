import type { Metadata } from 'next';
import { Package } from 'lucide-react';
import { Suspense } from 'react';
import { ProductForm } from '@/components/dashboard/products/product-form';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listDashboardCategories } from '@/features/catalog/dashboard';
import { emptyProductForm } from '@/features/catalog/product-schema';
import { getStorePlan, getUsage } from '@/features/billing/queries';
import { PRODUCT_LIMIT_MESSAGE } from '@/features/billing/schema';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Add product' };

async function NewProduct() {
  const { store } = await requireStore('/dashboard/products/new');
  const [categories, subscription, usage] = await Promise.all([
    listDashboardCategories(store.id),
    getStorePlan(store.id),
    getUsage(store.id),
  ]);
  const max = subscription?.plan.limits.products ?? null;
  // Say so before they fill in the form; saving checks again.
  if (max !== null && usage.products >= max) {
    return (
      <EmptyState
        icon={Package}
        title={`${usage.products} of ${max} products used`}
        description={PRODUCT_LIMIT_MESSAGE}
        testId="product-limit"
      />
    );
  }
  return (
    <ProductForm
      productId={null}
      initial={emptyProductForm()}
      categories={categories}
      liveUrl={null}
      photos={
        <p className="text-sm text-muted-foreground">
          Save the product first, then add its photos here.
        </p>
      }
    />
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NewProduct />
    </Suspense>
  );
}
