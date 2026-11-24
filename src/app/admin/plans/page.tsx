import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlanList } from '@/components/admin/plan-list';
import { Skeleton } from '@/components/ui/skeleton';
import { requireSuperAdmin } from '@/features/auth/session';
import { listPlans } from '@/features/billing/queries';

export const metadata: Metadata = { title: 'Plans' };

async function Plans() {
  await requireSuperAdmin('/admin/plans');
  return <PlanList plans={await listPlans()} />;
}

export default function PlansPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Plans />
    </Suspense>
  );
}
