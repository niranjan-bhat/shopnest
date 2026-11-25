'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { clientAddress } from '@/features/orders/client';
import { createServerSupabase } from '@/lib/supabase/server';
import { clearCodeChecks, recordAttempt } from './limits';
import {
  BOT_TOKEN_FIELD,
  safeNextPath,
  sendCodeSchema,
  verifyCodeSchema,
} from './schemas';
import { sendCodeIfAllowed } from './send-code';
import { passedBotCheck } from './turnstile';

const BOT_ERROR =
  'We could not check that you are not a bot. Please try again.';
const NETWORK_ERROR =
  'Too many attempts from your network. Try again in an hour.';

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

/** Step 1: email a 6-digit sign-in code, if this person has access. */
async function sendSignInCode(
  previous: SignInState,
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
  const stay = (error: string): SignInState => ({
    step: previous.step === 'code' ? 'code' : 'email',
    email,
    error,
  });

  const ip = clientAddress(await headers());
  if (!(await passedBotCheck(formData.get(BOT_TOKEN_FIELD), ip))) {
    return stay(BOT_ERROR);
  }

  switch (await recordAttempt('send', email, ip)) {
    case 'network':
      return stay(NETWORK_ERROR);
    // The last code may still be good, so leave them room to enter it.
    case 'wait':
      return {
        step: 'code',
        email,
        error:
          'You asked for a code a moment ago. Check your email, or wait a minute and ask again.',
      };
    case 'email':
      return {
        step: 'code',
        email,
        error:
          'Too many codes asked for. Use the last one, or try again in an hour.',
      };
  }
  after(() => sendCodeIfAllowed(email));
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

  const ip = clientAddress(await headers());
  if (!(await passedBotCheck(formData.get(BOT_TOKEN_FIELD), ip))) {
    return { step: 'code', email, error: BOT_ERROR };
  }
  const attempt = await recordAttempt('verify', parsed.data.email, ip);
  if (attempt !== 'ok') {
    return {
      step: 'code',
      email,
      error:
        attempt === 'network'
          ? NETWORK_ERROR
          : 'Too many wrong codes. Try again in an hour.',
    };
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
  await clearCodeChecks(parsed.data.email);
  redirect(safeNextPath(formData.get('next')));
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
