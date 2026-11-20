import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getServerEnv } from '@/lib/env';
import { getPublicEnv } from '@/lib/env.public';

let client: SupabaseClient<Database> | undefined;

/**
 * Service-role client: bypasses RLS. Server-only, for the few jobs that must
 * act above any one user: creating orders after re-pricing them (Phase 4)
 * and super-admin operations (Phase 5). Never pass its results to a client
 * without filtering by tenant.
 */
export function adminDb(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(
      getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
      getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
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
