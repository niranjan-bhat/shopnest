import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PlanForm } from '@/components/admin/plan-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { requireSuperAdmin } from '@/features/auth/session';
import { getPlan } from '@/features/billing/queries';
import { toRupeesInput } from '@/lib/money';

export const metadata: Metadata = { title: 'Plan' };

type Props = PageProps<'/admin/plans/[id]'>;

async function Plan({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  await requireSuperAdmin(`/admin/plans/${id}`);
  const plan = await getPlan(id);
  if (!plan) notFound();
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title={plan.name} />
      <PlanForm
        key={plan.id}
        planId={plan.id}
        initial={{
          name: plan.name,
          monthlyFee: toRupeesInput(plan.monthlyFeePaise),
          setupFee: toRupeesInput(plan.setupFeePaise),
          maxProducts: plan.limits.products?.toString() ?? '',
          maxTeam: plan.limits.team?.toString() ?? '',
          isActive: plan.isActive,
        }}
      />
    </div>
  );
}

export default function PlanPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Plan params={params} />
    </Suspense>
  );
}
