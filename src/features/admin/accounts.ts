import 'server-only';
import { adminDb } from '@/lib/supabase/admin';

// Kept out of the 'use server' files so it is not callable from the browser.

/** Auth's answers to "this email already has an account". */
const ACCOUNT_EXISTS = new Set(['email_exists', 'user_already_exists']);

/**
 * Makes sure a person has an account, so they can be added to the store
 * before they first sign in. They sign in with the usual emailed code; no
 * email is sent here.
 */
export async function ensureAccount(email: string): Promise<void> {
  const { error } = await adminDb().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error && !ACCOUNT_EXISTS.has(error.code ?? '')) {
    throw new Error(`Creating the account failed: ${error.message}`);
  }
}
