import 'server-only';
import { z } from 'zod';
import { parseEnv } from './env.public';

/**
 * Server-only environment variables. Importing this module from a Client
 * Component fails the build (via `server-only`), so secrets such as the
 * Supabase service-role key can never reach the browser.
 */
export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Returns the validated server env, parsed on first use. */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env, 'server');
  return cached;
}
