import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shown when a list has nothing in it yet, with the next step to take. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center"
      data-testid={testId}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-lg font-medium">{title}</h2>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
