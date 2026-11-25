import 'server-only';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { getPublicEnv } from '@/lib/env.public';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const resultSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
});

/**
 * Whether the visitor passed Cloudflare Turnstile. Without both keys (local
 * development, tests) there is no check. If Cloudflare cannot be reached the
 * visitor is let through: the limits still apply, and an outage there must
 * not keep every merchant out.
 */
export async function passedBotCheck(
  token: FormDataEntryValue | null,
  ip: string | null,
): Promise<boolean> {
  const secret = getServerEnv().TURNSTILE_SECRET_KEY;
  if (!secret || !getPublicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;

  let body: unknown;
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    body = await response.json();
  } catch (error) {
    console.error('Turnstile could not be reached:', error);
    return true;
  }
  const result = resultSchema.safeParse(body);
  if (result.success && result.data.success) return true;
  const codes = result.data?.['error-codes'] ?? [];
  // A wrong secret locks everyone out: make it easy to find in the logs.
  if (codes.some((code) => code.endsWith('-input-secret'))) {
    console.error('TURNSTILE_SECRET_KEY is wrong:', codes.join(', '));
  }
  return false;
}
