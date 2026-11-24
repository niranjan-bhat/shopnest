import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { listPlans } from '@/features/billing/queries';
import { formatINR } from '@/lib/money';

const many = (max: number | null, one: string, more: string) =>
  max === null ? `Unlimited ${more}` : `${max} ${max === 1 ? one : more}`;

export function PlanList({
  plans,
}: {
  plans: Awaited<ReturnType<typeof listPlans>>;
}) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Plans"
        description="What stores pay and what they get."
        actions={
          <Link href="/admin/plans/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New plan
          </Link>
        }
      />
      <ul
        className="divide-y overflow-hidden rounded-xl border"
        data-testid="plans"
      >
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link
              href={`/admin/plans/${plan.id}`}
              className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {plan.name}
                  {!plan.isActive && <Badge variant="outline">Retired</Badge>}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {many(plan.limits.products, 'product', 'products')} ·{' '}
                  {many(plan.limits.team, 'person', 'people')} · {plan.stores}{' '}
                  {plan.stores === 1 ? 'store' : 'stores'}
                </span>
              </span>
              <span className="text-right text-sm tabular-nums">
                {formatINR(plan.monthlyFeePaise)}/month
                {plan.setupFeePaise > 0 && (
                  <span className="block text-muted-foreground">
                    + {formatINR(plan.setupFeePaise)} setup
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
