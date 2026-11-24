import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDay } from '@/features/billing/dates';
import type { StorePlan, Usage } from '@/features/billing/queries';
import { usageText } from '@/features/billing/schema';
import { formatINR } from '@/lib/money';

/** The store's plan, what it uses of it, and when it next pays. */
export function PlanCard({
  subscription,
  usage,
}: {
  subscription: StorePlan;
  usage: Usage;
}) {
  const { plan, nextDue, overdue } = subscription;
  const rows = [
    ['Plan', `${plan.name} (${formatINR(plan.monthlyFeePaise)}/month)`],
    ['Products', usageText(usage.products, plan.limits.products)],
    ['People', usageText(usage.team, plan.limits.team)],
  ];
  return (
    <Card data-testid="plan-card">
      <CardHeader>
        <CardTitle>Your plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          To change it, ask the Zarify team. Archived products do not count.
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
          {nextDue && (
            <div className="contents">
              <dt className="text-muted-foreground">Next payment</dt>
              <dd>
                {formatDay(nextDue)}{' '}
                {overdue && <Badge variant="destructive">Overdue</Badge>}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
