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
  /** Cloudflare Turnstile on the login page; off when unset or empty. */
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

/** R2 credentials; only the upload code (Phase 3) needs them. */
export const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type R2Env = z.infer<typeof r2EnvSchema>;

let cached: ServerEnv | undefined;
let cachedR2: R2Env | undefined;

/** Returns the validated server env, parsed on first use. */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, process.env, 'server');
  return cached;
}

/** Returns the validated R2 env, parsed on first use. */
export function getR2Env(): R2Env {
  cachedR2 ??= parseEnv(r2EnvSchema, process.env, 'R2');
  return cachedR2;
}
