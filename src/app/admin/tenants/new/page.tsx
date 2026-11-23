import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewStoreForm } from '@/components/admin/new-store-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { listStoreOptions } from '@/features/admin/queries';
import { requireSuperAdmin } from '@/features/auth/session';
import { getPublicEnv } from '@/lib/env.public';
import { normalizeHostname } from '@/lib/tenant';

export const metadata: Metadata = { title: 'New store' };

async function NewStore() {
  await requireSuperAdmin('/admin/tenants/new');
  return (
    <NewStoreForm
      options={await listStoreOptions()}
      rootDomain={
        normalizeHostname(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN) ?? ''
      }
    />
  );
}

export default function NewStorePage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader
        title="New store"
        description="It stays hidden from shoppers until you make it live."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewStore />
      </Suspense>
    </div>
  );
}
