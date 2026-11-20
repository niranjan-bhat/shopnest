'use server';

import { redirect } from 'next/navigation';
import { getPublicEnv } from '@/lib/env.public';
import { createServerSupabase } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/tenant';
import { safeNextPath, sendCodeSchema, verifyCodeSchema } from './schemas';

export type SignInState =
  | { step: 'email'; email?: string; error?: string }
  | { step: 'code'; email: string; error?: string };

/**
 * The sign-in form's single action. The submit button's `intent` picks the
 * step: send (or resend) a code, verify it, or start over.
 */
export async function signIn(
  previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  switch (formData.get('intent')) {
    case 'verify':
      return verifySignInCode(previous, formData);
    case 'restart':
      return { step: 'email', email: String(formData.get('email') ?? '') };
    default:
      return sendSignInCode(previous, formData);
  }
}

/** Step 1: email a 6-digit sign-in code. */
async function sendSignInCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = sendCodeSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return {
      step: 'email',
      email: String(formData.get('email') ?? ''),
      error: parsed.error.issues[0]?.message,
    };
  }
  const { email } = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Anyone may create an account; it sees nothing until a super admin
      // adds it to a store.
      shouldCreateUser: true,
      emailRedirectTo: `${appOrigin(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN)}/auth/callback`,
    },
  });
  if (error) {
    return {
      step: 'email',
      email,
      error:
        error.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'We could not send a code right now. Please try again.',
    };
  }
  return { step: 'code', email };
}

/** Step 2: check the code and start the session. */
async function verifySignInCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = verifyCodeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) {
    return { step: 'code', email, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'email',
  });
  if (error) {
    return {
      step: 'code',
      email,
      error:
        'That code is wrong or has expired. Check the email or send a new code.',
    };
  }
  redirect(safeNextPath(formData.get('next')));
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
