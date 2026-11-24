import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlanForm } from '@/components/admin/plan-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { listStoreOptions } from '@/features/admin/queries';
import { requireSuperAdmin } from '@/features/auth/session';

export const metadata: Metadata = { title: 'New plan' };

async function NewPlan() {
  await requireSuperAdmin('/admin/plans/new');
  const { templates } = await listStoreOptions();
  return (
    <PlanForm
      planId={null}
      templates={templates}
      initial={{
        name: '',
        monthlyFee: '',
        setupFee: '0',
        maxProducts: '',
        maxTeam: '',
        isActive: true,
        allTemplates: true,
        templates: [],
      }}
    />
  );
}

export default function NewPlanPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="New plan" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewPlan />
      </Suspense>
    </div>
  );
}
