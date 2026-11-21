import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductForm } from '@/components/dashboard/products/product-form';
import { Skeleton } from '@/components/ui/skeleton';
import { listDashboardCategories } from '@/features/catalog/dashboard';
import { emptyProductForm } from '@/features/catalog/product-schema';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Add product' };

async function NewProduct() {
  const { store } = await requireStore('/dashboard/products/new');
  const categories = await listDashboardCategories(store.id);
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
