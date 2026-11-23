import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StoreDetail } from '@/components/admin/store-detail';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminStore } from '@/features/admin/queries';
import { requireSuperAdmin } from '@/features/auth/session';
import { getPublicEnv } from '@/lib/env.public';
import { appOrigin } from '@/lib/tenant';

export const metadata: Metadata = { title: 'Store' };

type Props = PageProps<'/admin/tenants/[id]'>;

async function Store({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  await requireSuperAdmin(`/admin/tenants/${id}`);
  const store = await getAdminStore(id);
  if (!store) notFound();
  const origin = appOrigin(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN);
  return <StoreDetail store={store} loginUrl={`${origin}/login`} />;
}

export default function StorePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Store params={params} />
    </Suspense>
  );
}
