import { z } from 'zod';

/**
 * Browser-safe environment variables (NEXT_PUBLIC_*). Next.js inlines these
 * into the client bundle at build time, so they must never hold secrets.
 * Server-only variables live in `env.ts`.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  /**
   * Where R2 object keys are served from: the bucket's domain
   * (https://media.shopnest.in) or, locally, a path under /public
   * (/mock-media).
   */
  NEXT_PUBLIC_MEDIA_BASE_URL: z
    .string()
    .refine(
      (value) =>
        /^https?:\/\//.test(value)
          ? URL.canParse(value)
          : /^\/[A-Za-z0-9._/-]+$/.test(value),
      'must be an http(s) URL or a path such as /mock-media',
    ),
  /** Platform domain for storefront subdomains, e.g. shopnest.in or localhost:3000 */
  NEXT_PUBLIC_ROOT_DOMAIN: z
    .string()
    .regex(
      /^[a-z0-9.-]+(:\d+)?$/i,
      'must be a host name, optionally with a port',
    ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Validates a set of variables, naming the bad keys without echoing values. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid ${label} environment variables:\n${problems}\n` +
        'Copy .env.example to .env.local and fill them in.',
    );
  }
  return result.data;
}

let cached: PublicEnv | undefined;

/**
 * Returns the validated public env. Parsed on first use (not at import) so
 * pages that do not need these variables keep working without them.
 */
export function getPublicEnv(): PublicEnv {
  cached ??= parseEnv(
    publicEnvSchema,
    {
      // Each variable is referenced literally so Next.js can inline it.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
      NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    },
    'public',
  );
  return cached;
}
