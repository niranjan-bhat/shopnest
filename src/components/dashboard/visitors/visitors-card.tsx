import { cn } from 'cn';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VISITOR_RANGES, type VisitorStats } from '@/features/visitors/schema';
import { VisitorsChart } from './visitors-chart';

/** Who came to the store, and how far they got. */
export function VisitorsCard({
  stats,
  days,
}: {
  stats: VisitorStats;
  days: number;
}) {
  const visitors = stats.daily.reduce((sum, d) => sum + d.visitors, 0);
  const steps = [
    { label: 'Visitors', value: visitors },
    { label: 'Added to bag', value: stats.bag },
    { label: 'Chats opened', value: stats.chats },
    { label: 'Orders', value: stats.orders },
  ];
  return (
    <Card data-testid="visitors">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Visitors</CardTitle>
        <nav aria-label="Visitors for" className="flex gap-1 text-sm">
          {VISITOR_RANGES.map((range) => (
            <Link
              key={range.days}
              href={`/dashboard?days=${range.days}`}
              scroll={false}
              aria-current={range.days === days ? 'page' : undefined}
              className={cn(
                'rounded-md px-2.5 py-1',
                range.days === days
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </CardHeader>
      <CardContent className="grid gap-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {steps.map((step) => (
            <div key={step.label}>
              <dt className="text-sm text-muted-foreground">{step.label}</dt>
              <dd className="mt-1 text-2xl font-semibold">{step.value}</dd>
            </div>
          ))}
        </dl>

        {visitors === 0 ? (
          <p className="text-sm text-muted-foreground">
            No visitors {days === 1 ? 'yet today' : 'in these days'}. Share your
            store&apos;s link on WhatsApp and Instagram to bring people in.
          </p>
        ) : (
          days > 1 && <VisitorsChart key={days} daily={stats.daily} />
        )}

        {stats.products.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Most viewed products</h3>
            <ol className="mt-2 divide-y text-sm">
              {stats.products.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="min-w-0 truncate hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {product.visitors}{' '}
                    {product.visitors === 1 ? 'person' : 'people'}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A good estimate: each person counts once a day. Your own visits are
          left out in browsers that opened the store from this dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
