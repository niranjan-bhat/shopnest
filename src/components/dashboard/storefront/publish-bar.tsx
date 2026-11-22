'use client';

import { Eye } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { discardThemeChanges } from '@/features/theme/actions';
import { PublishButton } from './publish-button';

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Live/unpublished status with Preview, Discard and Publish. */
export function PublishBar({
  hasChanges,
  publishedAt,
  canDiscard,
}: {
  hasChanges: boolean;
  publishedAt: string | null;
  canDiscard: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const discard = () =>
    startTransition(async () => {
      try {
        const result = await discardThemeChanges();
        if (!result.ok) {
          toast.error(result.error ?? 'Could not discard the changes.');
          return;
        }
        toast.success('Changes discarded');
        setConfirming(false);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
      data-testid="publish-bar"
    >
      <div className="min-w-0 flex-1">
        {hasChanges ? (
          <Badge variant="secondary">Unpublished changes</Badge>
        ) : (
          <Badge>Live</Badge>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {publishedAt
            ? `Last published ${dateFormat.format(new Date(publishedAt))}.`
            : 'Not published yet.'}{' '}
          {hasChanges && 'Shoppers see your changes after you publish.'}
        </p>
      </div>
      <a
        href="/preview"
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: 'outline' })}
      >
        <Eye aria-hidden />
        Preview
      </a>
      {hasChanges && canDiscard && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          Discard changes
        </Button>
      )}
      <PublishButton disabled={!hasChanges} />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unpublished changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The editor goes back to what your store shows now. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={discard}
              disabled={pending}
            >
              {pending ? 'Discarding…' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
