import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductForm } from '@/components/dashboard/products/product-form';
import { ProductPhotos } from '@/components/dashboard/products/product-photos';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getProductForEdit,
  listDashboardCategories,
} from '@/features/catalog/dashboard';
import { idSchema } from '@/features/catalog/schemas';
import { requireStore } from '@/features/tenants/access';
import { isR2Configured } from '@/lib/r2';

export const metadata: Metadata = { title: 'Edit product' };

type Props = PageProps<'/dashboard/products/[id]'>;

async function EditProduct({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  const { store } = await requireStore(`/dashboard/products/${id}`);
  const productId = idSchema.safeParse(id);
  if (!productId.success) notFound();

  const [product, categories] = await Promise.all([
    getProductForEdit(store.id, productId.data),
    listDashboardCategories(store.id),
  ]);
  if (!product) notFound();

  return (
    <ProductForm
      // A save changes updatedAt, so the form restarts from the saved data.
      key={product.updatedAt}
      productId={product.id}
      initial={product.values}
      categories={categories}
      liveUrl={
        product.status === 'active' && store.url
          ? `${store.url}/p/${product.slug}`
          : null
      }
      photos={
        <ProductPhotos
          productId={product.id}
          productName={product.values.name}
          images={product.images}
          uploadsEnabled={isR2Configured()}
        />
      }
    />
  );
}

export default function EditProductPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditProduct params={params} />
    </Suspense>
  );
}
