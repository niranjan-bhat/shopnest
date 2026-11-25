'use client';

import { cn } from 'cn';
import { Check, Eye } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { discardThemeChanges } from '@/features/theme/actions';
import { useEditing } from './editor-status';
import { PublishButton } from './publish-button';

/** True once a sticky element has reached its `top` and is pinned there. */
function useStuck(ref: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      // Half a pixel of slack for fractional layouts.
      setStuck(
        window.scrollY > 0 && el.getBoundingClientRect().top <= top + 0.5,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
  return stuck;
}

const STATUS: Record<Stage, string> = {
  edit: 'Unsaved edits',
  draft: 'Unpublished changes',
  live: 'Live',
};

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type Stage = 'edit' | 'draft' | 'live';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'edit', label: 'Edit' },
  { stage: 'draft', label: 'Draft' },
  { stage: 'live', label: 'Live' },
];

/** Where the changes are: Edit, then Draft, then Live. Status, not buttons. */
function StageTrack({ stage }: { stage: Stage }) {
  const current = STEPS.findIndex((step) => step.stage === stage);
  return (
    <ol
      aria-label="Publishing status"
      className="flex items-center gap-2 text-sm"
    >
      {STEPS.map((step, index) => {
        // Live is the end of the track: reached, nothing left to do.
        const done = index < current || stage === 'live';
        const active = index === current;
        const waiting = active && !done;
        return (
          <li
            key={step.stage}
            aria-current={active ? 'step' : undefined}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                done && 'border-emerald-600 bg-emerald-600 text-white',
                waiting &&
                  'border-amber-500 text-amber-700 ring-3 ring-amber-500/25 dark:text-amber-400',
                !done && !active && 'text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                active && 'font-medium',
                !done && !active && 'text-muted-foreground',
              )}
            >
              {step.label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'h-px min-w-4 flex-1',
                  done ? 'bg-emerald-600' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The Edit → Draft → Live track with Preview, Discard and Publish. */
export function PublishBar({
  hasChanges,
  publishedAt,
  hasPublished,
}: {
  hasChanges: boolean;
  publishedAt: string | null;
  /** A theme is live; stores set up from the demo have one but no date. */
  hasPublished: boolean;
}) {
  const editing = useEditing();
  const stage: Stage = editing ? 'edit' : hasChanges ? 'draft' : 'live';
  const band = useRef<HTMLDivElement>(null);
  const stuck = useStuck(band);
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
    // An opaque band the width of the page, joined to the header, so the
    // form scrolls cleanly underneath it. A soft shadow (no divider) shows
    // once it is pinned; it changes nothing's size, so nothing shifts.
    <div
      ref={band}
      className={cn(
        'sticky top-14 z-20 -mx-4 bg-background px-4 py-3 transition-shadow duration-200 md:-mx-8 md:px-8',
        stuck && 'shadow-[0_8px_12px_-10px_rgb(0_0_0/0.3)]',
      )}
      data-stuck={stuck || undefined}
      data-testid="publish-bar"
    >
      <div className="grid gap-3 rounded-xl border bg-card p-3">
        <StageTrack stage={stage} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1" data-testid="publish-status">
            <p className="text-sm font-medium">{STATUS[stage]}</p>
            <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
              {stage === 'edit' && 'Save the draft below to keep them. '}
              {stage === 'draft' &&
                'Shoppers still see your last published look. '}
              {publishedAt
                ? `Last published ${dateFormat.format(new Date(publishedAt))}.`
                : hasPublished
                  ? 'Shoppers see your store.'
                  : 'Not published yet.'}
            </p>
          </div>
          <a
            href="/preview"
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: 'outline' })}
          >
            <Eye aria-hidden />
            Preview
          </a>
          {hasChanges && hasPublished && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(true)}
              disabled={pending}
            >
              Discard changes
            </Button>
          )}
          {/* Publishing now would leave the unsaved edits out. */}
          <PublishButton disabled={!hasChanges || editing} />
        </div>
      </div>

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
