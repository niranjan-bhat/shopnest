import 'server-only';
import { createHmac } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import { adminDb } from '@/lib/supabase/admin';
import { check } from '@/lib/supabase/result';

// Limits on asking for and guessing sign-in codes. The database keeps only
// keyed hashes of the email and the network address
// (20261125100000_sign_in_limits.sql).

export type AttemptKind = 'send' | 'verify';
export type AttemptResult = 'ok' | 'wait' | 'email' | 'network';

/**
 * What counts as one network: an IPv4 address, or the first half (/64) of an
 * IPv6 one, since a single connection can use any address inside its /64.
 */
export function networkOf(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.toLowerCase().split('%')[0].split('::');
  const groups = head ? head.split(':') : [];
  if (tail !== undefined) {
    const rest = tail ? tail.split(':') : [];
    const zeros = Math.max(0, 8 - groups.length - rest.length);
    groups.push(...Array<string>(zeros).fill('0'), ...rest);
  }
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':');
}

/** 64 hex characters; the same value always gives the same key. */
export function signInKey(
  kind: 'email' | 'network',
  value: string,
  secret: string,
): string {
  return createHmac('sha256', `zarify-sign-in-${kind}:${secret}`)
    .update(value)
    .digest('hex');
}

/** Counts an attempt, or says which limit it met. */
export async function recordAttempt(
  kind: AttemptKind,
  email: string,
  ip: string | null,
): Promise<AttemptResult> {
  const secret = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  const result = check(
    await adminDb().rpc('record_sign_in_attempt', {
      attempt: kind,
      email_key: signInKey('email', email, secret),
      client: ip ? signInKey('network', networkOf(ip), secret) : undefined,
    }),
    'record_sign_in_attempt',
  );
  return result as AttemptResult;
}

/** After a right code: earlier wrong ones no longer count. */
export async function clearCodeChecks(email: string): Promise<void> {
  const { error } = await adminDb()
    .from('sign_in_attempts')
    .delete()
    .eq('kind', 'verify')
    .eq(
      'email_hash',
      signInKey('email', email, getServerEnv().SUPABASE_SERVICE_ROLE_KEY),
    );
  if (error) console.error('Clearing sign-in attempts failed:', error.message);
}
