'use server';

import { refresh } from 'next/cache';
import { requireSuperAdminForAction } from '@/features/auth/session';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureAccount } from './accounts';
import {
  addMemberSchema,
  changeMemberSchema,
  TEAM_LIMIT_CODE,
} from './team-schema';

// Super admin team changes. The database functions check for a super admin
// again, keep an owner in the store and log every change.

/** Adds someone to a store; they sign in with the usual emailed code. */
export async function addMember(input: unknown): Promise<ActionResult> {
  await requireSuperAdminForAction();
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const { storeId, email, role } = parsed.data;
  await ensureAccount(email);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('add_member', {
    tid: storeId,
    member_email: email,
    member_role: role,
  });
  if (error?.code === TEAM_LIMIT_CODE) {
    return {
      ok: false,
      error:
        'The plan’s team limit is reached. Remove someone or move the store to a bigger plan.',
    };
  }
  if (error) throw new Error(`Adding the person failed: ${error.message}`);
  if (!data) return { ok: false, error: 'They are already on the team.' };
  refresh();
  return { ok: true };
}

/** Changes someone's role or, with role null, removes them. */
export async function changeMember(input: unknown): Promise<ActionResult> {
  await requireSuperAdminForAction();
  const parsed = changeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }
  const { storeId, userId, role } = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('change_member', {
    tid: storeId,
    uid: userId,
    new_role: role ?? undefined,
  });
  if (error) throw new Error(`Changing the team failed: ${error.message}`);
  if (!data) {
    return {
      ok: false,
      error: 'A store needs an owner. Make someone else an owner first.',
    };
  }
  refresh();
  return { ok: true };
}
