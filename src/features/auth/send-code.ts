import 'server-only';
import { getPublicEnv } from '@/lib/env.public';
import { adminDb } from '@/lib/supabase/admin';
import { check } from '@/lib/supabase/result';
import { appOrigin } from '@/lib/tenant';

/**
 * Emails a sign-in code if the address belongs to a store member or a super
 * admin; otherwise does nothing. Runs after the response is sent, so neither
 * the answer nor its timing shows which it was.
 *
 * Uses the service role: once the bot check is on in Supabase Auth, it
 * refuses codes asked for without one, except from the server, which has
 * already checked the visitor.
 */
export async function sendCodeIfAllowed(email: string): Promise<void> {
  try {
    const db = adminDb();
    const allowed = check(
      await db.rpc('can_sign_in', { member_email: email }),
      'can_sign_in',
    );
    if (!allowed) return;
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appOrigin(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN)}/auth/callback`,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error('Sending a sign-in code failed:', error);
  }
}
