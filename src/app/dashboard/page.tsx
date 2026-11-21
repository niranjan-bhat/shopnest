import {
  ArrowRight,
  CircleCheck,
  Circle,
  FolderTree,
  Package,
  Palette,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireDashboard } from '@/features/tenants/access';
import type { StoreRole } from '@/features/tenants/active-store';
import { getStoreStats } from '@/features/tenants/dashboard';

export const metadata: Metadata = { title: 'Overview' };

const ROLE_TEXT: Record<StoreRole, string> = {
  owner: 'You own this store.',
  staff: 'You are on this store’s team.',
  admin: 'You are viewing this store as a super admin.',
};

const STATUS_TEXT = {
  active: 'Live',
  onboarding: 'Not live yet',
  suspended: 'Suspended',
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

type Step = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  done?: boolean;
};

function NextSteps({ steps }: { steps: Step[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your store</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {steps.map((step) => {
            const Icon = step.icon;
            const Status = step.done ? CircleCheck : Circle;
            return (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="group flex items-center gap-4 py-3"
                >
                  <Status
                    aria-label={step.done ? 'Done' : 'To do'}
                    className={
                      step.done
                        ? 'size-5 shrink-0 text-emerald-600'
                        : 'size-5 shrink-0 text-muted-foreground/50'
                    }
                  />
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{step.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {step.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

async function Overview() {
  const { user, store } = await requireDashboard('/dashboard');

  if (!store) {
    return (
      <EmptyState
        icon={Store}
        title="No store yet"
        testId="no-stores"
        description={
          <>
            <p>
              You don&apos;t have access to a store yet. Ask the Zarify team to
              add you.
            </p>
            <p className="mt-2">
              Signed in as <span data-testid="user-email">{user.email}</span>
            </p>
          </>
        }
      />
    );
  }

  const stats = await getStoreStats(store.id);
  return (
    <div className="grid gap-8">
      <PageHeader title={store.name} description={ROLE_TEXT[store.role]} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Products"
          value={String(stats.products)}
          hint={`${stats.activeProducts} live on your store`}
        />
        <Stat label="Categories" value={String(stats.categories)} />
        <Stat label="Store" value={STATUS_TEXT[store.status]} />
      </div>
      <NextSteps
        steps={[
          {
            href: '/dashboard/categories',
            icon: FolderTree,
            title: 'Add categories',
            description: 'Group products the way shoppers browse.',
            done: stats.categories > 0,
          },
          {
            href: '/dashboard/products',
            icon: Package,
            title: 'Add products',
            description: 'Photos, prices, sizes and stock.',
            done: stats.products > 0,
          },
          {
            href: '/dashboard/storefront',
            icon: Palette,
            title: 'Brand your storefront',
            description: 'Logo, colours, fonts and home page sections.',
          },
          {
            href: '/dashboard/settings',
            icon: Settings,
            title: 'Check store details',
            description: 'Name, WhatsApp number and policies.',
          },
        ]}
      />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}
