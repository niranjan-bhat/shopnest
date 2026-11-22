import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  bannerStatus,
  bannerUses,
  isoToIst,
  type BannerStatus,
  type BannerUse,
} from './banners';
import type { ThemeEditorData } from './editor';

export type DashboardBanner = {
  id: string;
  imageKey: string;
  heading: string | null;
  link: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** The dates as datetime-local values in Indian time, for the form. */
  startsAtLocal: string;
  endsAtLocal: string;
  /** Whether shoppers can see it now. */
  status: BannerStatus;
  /** Home sections that name this banner (draft or live). */
  uses: BannerUse[];
};

/**
 * Every banner of the store, scheduled and ended ones included (as the
 * signed-in member; RLS shows the store's team all of them).
 */
export async function listDashboardBanners(
  tenantId: string,
  editor: ThemeEditorData | null,
): Promise<DashboardBanner[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('banners')
      .select('id, image_key, heading, link, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .order('position')
      .order('created_at'),
    'banners',
  );
  const themes = editor ? [editor.draft, editor.published] : [];
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    imageKey: row.image_key,
    heading: row.heading,
    link: row.link,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startsAtLocal: row.starts_at ? isoToIst(row.starts_at) : '',
    endsAtLocal: row.ends_at ? isoToIst(row.ends_at) : '',
    status: bannerStatus({ startsAt: row.starts_at, endsAt: row.ends_at }, now),
    uses: bannerUses(row.id, themes),
  }));
}
