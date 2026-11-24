'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  recordPayment,
  setSubscription,
  voidPayment,
} from '@/features/billing/actions';
import { formatDay } from '@/features/billing/dates';
import type { Payment, Plan, StorePlan } from '@/features/billing/queries';
import { PAYMENT_METHODS, type PaymentField } from '@/features/billing/schema';
import type { ActionResult } from '@/lib/action-result';
import { formatINR, toRupeesInput } from '@/lib/money';
import { useHydrated } from '@/lib/use-hydrated';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** A store's plan, when it next pays, and its payments. */
export function BillingCard({
  storeId,
  subscription,
  plans,
  payments,
  today,
}: {
  storeId: string;
  subscription: StorePlan | null;
  /** Plans a store can be moved to. */
  plans: Pick<Plan, 'id' | 'name' | 'monthlyFeePaise'>[];
  payments: Payment[];
  today: string;
}) {
  const hydrated = useHydrated();
  return (
    <Card data-testid="billing" data-hydrated={hydrated || undefined}>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <p className="text-sm text-muted-foreground" data-testid="billing-due">
          {subscription?.nextDue ? (
            <>
              Next payment due {formatDay(subscription.nextDue)}{' '}
              {subscription.overdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </>
          ) : (
            'Not billed. Billing starts when the store first goes live, or on the date below.'
          )}
        </p>
      </CardHeader>
      <CardContent className="grid gap-8">
        <SubscriptionForm
          // Restarts from the saved values after each save.
          key={`${subscription?.plan.id}:${subscription?.billingStart}`}
          storeId={storeId}
          subscription={subscription}
          plans={plans}
        />
        {subscription && (
          <PaymentForm
            key={subscription.plan.id}
            storeId={storeId}
            plan={subscription.plan}
            today={today}
          />
        )}
        {payments.length > 0 && (
          <PaymentList storeId={storeId} payments={payments} />
        )}
      </CardContent>
    </Card>
  );
}

/** Runs an action, says how it went, and returns whether it worked. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const run = <Field extends string>(
    action: () => Promise<ActionResult<Field>>,
    done: string,
    onResult?: (result: ActionResult<Field>) => void,
  ) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(done);
        else {
          toast.error(
            result.error ??
              (Object.values(result.fieldErrors ?? {})[0] as
                string | undefined) ??
              'Check what you entered.',
          );
        }
        onResult?.(result);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  return { pending, run };
}

function SubscriptionForm({
  storeId,
  subscription,
  plans,
}: {
  storeId: string;
  subscription: StorePlan | null;
  plans: Pick<Plan, 'id' | 'name' | 'monthlyFeePaise'>[];
}) {
  const { pending, run } = useAction();
  const current = subscription?.plan;
  // A retired plan is offered only to the store that is already on it.
  const options =
    current && !plans.some((plan) => plan.id === current.id)
      ? [current, ...plans]
      : plans;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(
      () =>
        setSubscription({
          storeId,
          planId: form.get('planId'),
          billingStart: form.get('billingStart'),
        }),
      'Billing saved',
    );
  };

  return (
    <form
      onSubmit={save}
      className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
      aria-label="Plan and billing start"
    >
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Plan</span>
        <select
          name="planId"
          aria-label="Plan"
          defaultValue={current?.id}
          className={selectClass}
        >
          {options.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} ({formatINR(plan.monthlyFeePaise)}/month)
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Billing starts</span>
        <Input
          type="date"
          name="billingStart"
          defaultValue={subscription?.billingStart ?? ''}
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save billing'}
      </Button>
    </form>
  );
}

function PaymentForm({
  storeId,
  plan,
  today,
}: {
  storeId: string;
  plan: Plan;
  today: string;
}) {
  const { pending, run } = useAction();
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [months, setMonths] = useState('1');
  const [amount, setAmount] = useState(toRupeesInput(plan.monthlyFeePaise));
  // Once edited by hand, the amount no longer follows the months.
  const [amountEdited, setAmountEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>(
    {},
  );

  const suggest = (value: string) => {
    const n = /^\d{1,2}$/.test(value) ? Number(value) : 1;
    return toRupeesInput(
      n === 0 ? plan.setupFeePaise : plan.monthlyFeePaise * n,
    );
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    run(
      () =>
        recordPayment({
          storeId,
          paymentId,
          amount: form.get('amount'),
          paidOn: form.get('paidOn'),
          method: form.get('method'),
          months: form.get('months'),
          reference: form.get('reference'),
        }),
      'Payment recorded',
      (result) => {
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          return;
        }
        formElement.reset();
        setPaymentId(crypto.randomUUID());
        setMonths('1');
        setAmount(suggest('1'));
        setAmountEdited(false);
        setErrors({});
      },
    );
  };

  const error = (name: PaymentField) =>
    errors[name] && (
      <span className="text-destructive" role="alert">
        {errors[name]}
      </span>
    );

  return (
    <form onSubmit={save} className="grid gap-4" aria-label="Record a payment">
      <h3 className="font-medium">Record a payment</h3>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Months</span>
          <Input
            name="months"
            inputMode="numeric"
            value={months}
            onChange={(event) => {
              setMonths(event.target.value);
              if (!amountEdited) setAmount(suggest(event.target.value));
            }}
          />
          {error('months')}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Amount (₹)</span>
          <Input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountEdited(true);
            }}
          />
          {error('amount')}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Paid on</span>
          <Input type="date" name="paidOn" defaultValue={today} max={today} />
          {error('paidOn')}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Method</span>
          <select name="method" aria-label="Method" className={selectClass}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Reference</span>
          <Input name="reference" placeholder="UTR, receipt no." />
          {error('reference')}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Record payment'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Use 0 months for a setup fee on its own.
        </p>
      </div>
    </form>
  );
}

function PaymentList({
  storeId,
  payments,
}: {
  storeId: string;
  payments: Payment[];
}) {
  const { pending, run } = useAction();
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <div className="grid gap-3">
      <h3 className="font-medium">Payments</h3>
      <ul className="divide-y rounded-lg border text-sm" aria-label="Payments">
        {payments.map((payment) => (
          <li key={payment.id} className="grid gap-3 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span
                className={
                  payment.voidReason
                    ? 'font-medium tabular-nums line-through'
                    : 'font-medium tabular-nums'
                }
              >
                {formatINR(payment.amountPaise)}
              </span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {formatDay(payment.paidOn)} · {PAYMENT_METHODS[payment.method]}{' '}
                ·{' '}
                {payment.months === 0
                  ? 'no months'
                  : `${payment.months} ${payment.months === 1 ? 'month' : 'months'}`}
                {payment.reference && ` · ${payment.reference}`}
                {payment.voidReason && ` · Voided: ${payment.voidReason}`}
              </span>
              {!payment.voidReason && voiding !== payment.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setVoiding(payment.id);
                    setReason('');
                  }}
                >
                  Void…
                </Button>
              )}
            </div>
            {voiding === payment.id && !payment.voidReason && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-48 flex-1"
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why is it wrong?"
                  aria-label="Reason for voiding"
                />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending || reason.trim() === ''}
                  onClick={() =>
                    run(
                      () =>
                        voidPayment({ storeId, paymentId: payment.id, reason }),
                      'Payment voided',
                      (result) => result.ok && setVoiding(null),
                    )
                  }
                >
                  Void payment
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setVoiding(null)}
                >
                  Keep it
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
