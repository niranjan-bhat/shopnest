import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CategoryManager } from '@/components/dashboard/categories/category-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { listDashboardCategories } from '@/features/catalog/dashboard';
import { requireStore } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Categories' };

async function Categories() {
  const { store } = await requireStore('/dashboard/categories');
  const categories = await listDashboardCategories(store.id);
  return <CategoryManager categories={categories} />;
}

function CategoriesSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <Categories />
    </Suspense>
  );
}
