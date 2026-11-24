'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { requireSuperAdminForAction } from '@/features/auth/session';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  paymentSchema,
  planSchema,
  subscriptionSchema,
  voidSchema,
  type PaymentField,
  type PlanField,
} from './schema';

// Super admin billing. The database functions check for a super admin again
// and log every change.

function fieldErrorsOf<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    errors[issue.path[0] as Field] ??= issue.message;
  }
  return errors;
}

/** Creates a plan (id null) or changes one. */
export async function savePlan(
  id: string | null,
  input: unknown,
): Promise<ActionResult<PlanField>> {
  await requireSuperAdminForAction();
  const planId = z.uuid().nullable().parse(id);
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf<PlanField>(parsed.error) };
  }
  const plan = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('save_plan', {
    plan_name: plan.name,
    setup_fee: plan.setupFee,
    monthly_fee: plan.monthlyFee,
    active: plan.isActive,
    pid: planId ?? undefined,
    max_products: plan.maxProducts ?? undefined,
    max_team: plan.maxTeam ?? undefined,
  });
  if (error?.code === '23505') {
    return {
      ok: false,
      fieldErrors: { name: 'Another plan has this name' },
    };
  }
  if (error) throw new Error(`Saving the plan failed: ${error.message}`);
  refresh();
  return { ok: true };
}

/** Moves a store to a plan and sets when its billing starts. */
export async function setSubscription(input: unknown): Promise<ActionResult> {
  await requireSuperAdminForAction();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const { storeId, planId, billingStart } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_subscription', {
    tid: storeId,
    plan: planId,
    starts: billingStart || undefined,
  });
  if (error?.code === '22023') {
    return { ok: false, error: 'This plan is no longer available.' };
  }
  if (error) throw new Error(`Changing the plan failed: ${error.message}`);
  refresh();
  return { ok: true };
}

export async function recordPayment(
  input: unknown,
): Promise<ActionResult<PaymentField>> {
  await requireSuperAdminForAction();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsOf<PaymentField>(parsed.error),
    };
  }
  const payment = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('record_payment', {
    tid: payment.storeId,
    pid: payment.paymentId,
    amount: payment.amount,
    paid: payment.paidOn,
    how: payment.method,
    months: payment.months,
    ref: payment.reference || undefined,
  });
  if (error?.code === '22023') {
    return {
      ok: false,
      fieldErrors: { paidOn: 'A payment cannot be in the future' },
    };
  }
  if (error?.code === 'P0002') {
    return { ok: false, error: 'Put the store on a plan first.' };
  }
  if (error) throw new Error(`Recording the payment failed: ${error.message}`);
  refresh();
  return { ok: true };
}

export async function voidPayment(input: unknown): Promise<ActionResult> {
  await requireSuperAdminForAction();
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const { storeId, paymentId, reason } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('void_payment', {
    tid: storeId,
    pid: paymentId,
    reason,
  });
  if (error) throw new Error(`Voiding the payment failed: ${error.message}`);
  refresh();
  return { ok: true };
}
