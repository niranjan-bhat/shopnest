import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env.public';

/**
 * Browser client for Client Components (anon key; the signed-in user's
 * session comes from cookies, so RLS applies). Prefer Server Actions for
 * writes; this is for things that must run in the browser, such as direct
 * uploads in Phase 3.
 */
export function createBrowserSupabase() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
