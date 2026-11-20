import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const sendCodeSchema = z.object({ email });

export const verifyCodeSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});

/**
 * Where to go after signing in. Only same-site dashboard or admin paths are
 * allowed, so a crafted ?next= cannot send people to another site.
 */
export function safeNextPath(next: unknown): string {
  if (
    typeof next === 'string' &&
    /^\/(dashboard|admin)(\/[A-Za-z0-9\-._~/]*)?$/.test(next) &&
    !next.includes('//')
  ) {
    return next;
  }
  return '/dashboard';
}
