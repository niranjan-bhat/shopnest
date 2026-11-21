import type { LucideIcon } from 'lucide-react';
import { Suspense } from 'react';
import { requireStore } from '@/features/tenants/access';
import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';

async function Guarded({
  path,
  icon,
  upcoming,
}: {
  path: string;
  icon: LucideIcon;
  upcoming: string;
}) {
  await requireStore(path);
  return (
    <EmptyState
      icon={icon}
      title="Coming soon"
      description={upcoming}
      testId="section-placeholder"
    />
  );
}

/**
 * A dashboard section that is not built yet. It still checks access, so the
 * route behaves like the finished page will (Phase 3 replaces each one).
 */
export function SectionPlaceholder({
  path,
  title,
  description,
  icon,
  upcoming,
}: {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  upcoming: string;
}) {
  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />
      <Suspense fallback={null}>
        <Guarded path={path} icon={icon} upcoming={upcoming} />
      </Suspense>
    </div>
  );
}
