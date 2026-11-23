'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { allowEditing, stopEditing } from '@/features/admin/status-actions';
import { useReportReadOnly } from './read-only';

const time = new Intl.DateTimeFormat('en-IN', {
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

/** Says a super admin is viewing the store, and whether they may edit it. */
export function AdminViewBar({
  storeName,
  editingUntil,
  children,
}: {
  storeName: string;
  /** When the edit session ends; null while read-only. */
  editingUntil: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useReportReadOnly(editingUntil === null);

  // Back to read-only on time, without waiting for a click.
  useEffect(() => {
    if (!editingUntil) return;
    const left = new Date(editingUntil).getTime() - Date.now();
    const timer = setTimeout(() => router.refresh(), Math.max(left, 0) + 1000);
    return () => clearTimeout(timer);
  }, [editingUntil, router]);

  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await action();
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 md:px-8 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      data-testid="admin-view-bar"
    >
      <p className="min-w-0 flex-1" role="status">
        <strong>Viewing {storeName} as a super admin.</strong>{' '}
        {editingUntil
          ? `Editing is allowed until ${time.format(new Date(editingUntil))}.`
          : 'Read only.'}
      </p>
      {editingUntil ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(stopEditing)}
        >
          Stop editing
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(allowEditing)}
        >
          Allow editing for 30 minutes
        </Button>
      )}
      {children}
    </div>
  );
}
