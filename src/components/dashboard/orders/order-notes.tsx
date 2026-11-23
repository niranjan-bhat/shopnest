'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { saveOrderNotes } from '@/features/orders/dashboard-actions';

/** The store's own notes on an order; the customer never sees them. */
export function OrderNotes({
  orderId,
  initial,
}: {
  orderId: string;
  initial: string;
}) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = notes.trim() !== saved.trim();

  const save = () =>
    startTransition(async () => {
      try {
        const result = await saveOrderNotes(orderId, notes);
        if (!result.ok) {
          toast.error(result.error ?? 'Could not save the notes.');
          return;
        }
        setSaved(notes);
        toast.success('Notes saved');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <div className="grid gap-3">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Blouse stitching, delivery date, courier and tracking number…"
        aria-label="Your notes"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? 'Saving…' : 'Save notes'}
        </Button>
      </div>
    </div>
  );
}
