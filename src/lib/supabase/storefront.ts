import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getPublicEnv } from '@/lib/env.public';

let client: SupabaseClient<Database> | undefined;

/**
 * Anonymous, cookie-free client for public storefront reads. It never sees a
 * user session, so its results are the same for every visitor and are safe
 * to keep in `'use cache'`. RLS limits it to live, public data; queries still
 * filter by tenant_id explicitly.
 */
export function storefrontDb(): SupabaseClient<Database> {
  if (!client) {
    const env = getPublicEnv();
    client = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return client;
}
