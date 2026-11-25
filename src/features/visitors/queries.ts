import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { visitorStatsSchema, type VisitorStats } from './schema';

/** A store's visitors over the last `days` days, today included. */
export async function getVisitorStats(
  tenantId: string,
  days: number,
): Promise<VisitorStats> {
  const supabase = await createServerSupabase();
  return visitorStatsSchema.parse(
    check(
      await supabase.rpc('store_visitor_stats', { tid: tenantId, days }),
      'store_visitor_stats',
    ),
  );
}
