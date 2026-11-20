import type { PostgrestSingleResponse } from '@supabase/supabase-js';

/**
 * Returns a query's data, or throws with a readable message. Use it on every
 * Supabase read so failures surface as errors, not as empty results.
 */
export function check<T>(result: PostgrestSingleResponse<T>, what: string): T {
  if (result.error) {
    throw new Error(
      `Supabase query failed (${what}): ${result.error.message}`,
      {
        cause: result.error,
      },
    );
  }
  return result.data;
}
