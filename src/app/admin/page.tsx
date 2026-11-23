import { Suspense } from 'react';
import { StoreList } from '@/components/admin/store-list';
import { Skeleton } from '@/components/ui/skeleton';
import { listAdminStores } from '@/features/admin/queries';
import { parseStoreListFilter } from '@/features/admin/store-list';
import { requireSuperAdmin } from '@/features/auth/session';

type Props = PageProps<'/admin'>;

async function Stores({ searchParams }: Pick<Props, 'searchParams'>) {
  await requireSuperAdmin('/admin');
  const filter = parseStoreListFilter(await searchParams);
  return <StoreList {...await listAdminStores(filter)} filter={filter} />;
}

export default function AdminPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Stores searchParams={searchParams} />
    </Suspense>
  );
}
