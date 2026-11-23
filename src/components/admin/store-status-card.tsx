'use client';

import { Circle, CircleCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CHECKLIST, MISSING, type Missing } from '@/features/admin/status';
import { setStoreStatus } from '@/features/admin/status-actions';
import type { TenantStatus } from '@/features/admin/store-list';
import { useHydrated } from '@/lib/use-hydrated';

/** Go live (with its checklist), suspend and reactivate. */
export function StoreStatusCard({
  storeId,
  status,
  missing,
  suspendedReason,
}: {
  storeId: string;
  status: TenantStatus;
  missing: Missing[];
  suspendedReason: string | null;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');

  const change = (input: object, done: string) =>
    startTransition(async () => {
      try {
        const result = await setStoreStatus({ storeId, ...input });
        if (!result.ok) {
          toast.error(result.error ?? 'Could not change the store.');
          return;
        }
        setSuspending(false);
        setReason('');
        toast.success(done);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <Card data-testid="store-status-card" data-hydrated={hydrated || undefined}>
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {status === 'onboarding' && (
          <>
            <p className="text-muted-foreground">
              Shoppers cannot see this store yet. It needs:
            </p>
            <ul className="grid gap-2">
              {MISSING.map((item) => {
                const done = !missing.includes(item);
                const Icon = done ? CircleCheck : Circle;
                return (
                  <li key={item} className="flex items-center gap-2">
                    <Icon
                      aria-label={done ? 'Done' : 'To do'}
                      className={
                        done
                          ? 'size-4 text-emerald-600'
                          : 'size-4 text-muted-foreground/50'
                      }
                    />
                    {CHECKLIST[item]}
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground">
              Check the WhatsApp number in Details too: orders go to it.
            </p>
            <div>
              <Button
                type="button"
                disabled={pending || missing.length > 0}
                onClick={() =>
                  change({ status: 'active' }, 'The store is live')
                }
              >
                {pending ? 'Going live…' : 'Go live'}
              </Button>
            </div>
          </>
        )}

        {status === 'active' && !suspending && (
          <>
            <p className="text-muted-foreground">
              Shoppers can open this store and place orders.
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuspending(true)}
              >
                Suspend…
              </Button>
            </div>
          </>
        )}

        {status === 'active' && suspending && (
          <>
            <p>
              Shoppers will see that the store is unavailable and cannot order.
              The merchant can still sign in, finish orders and make changes.
            </p>
            <div className="grid gap-2">
              <label htmlFor="suspend-reason" className="font-medium">
                Reason (the merchant sees this)
              </label>
              <Textarea
                id="suspend-reason"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={pending || reason.trim() === ''}
                onClick={() =>
                  change(
                    { status: 'suspended', reason },
                    'The store is suspended',
                  )
                }
              >
                {pending ? 'Suspending…' : 'Suspend store'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setSuspending(false)}
              >
                Keep it live
              </Button>
            </div>
          </>
        )}

        {status === 'suspended' && (
          <>
            <p>Reason: {suspendedReason ?? 'not given'}</p>
            <div>
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  change({ status: 'active' }, 'The store is live again')
                }
              >
                {pending ? 'Reactivating…' : 'Reactivate'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
