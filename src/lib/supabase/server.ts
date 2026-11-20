import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env.public';

/**
 * Client acting as the signed-in user (session from cookies), so RLS applies.
 * For Server Components, Server Actions and Route Handlers. Create one per
 * request; never use it inside `'use cache'`.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. proxy.ts refreshes the
            // session on every app-host request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
