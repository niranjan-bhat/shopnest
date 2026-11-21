import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';

// Catalog reads for the merchant dashboard. They run as the signed-in user
// (RLS applies), include hidden and draft rows, are never cached, and filter
// by tenant_id explicitly.

export type DashboardCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** Products linked to the category, whatever their status. */
  productCount: number;
};

export async function listDashboardCategories(
  tenantId: string,
): Promise<DashboardCategory[]> {
  const supabase = await createServerSupabase();
  const rows = check(
    await supabase
      .from('categories')
      .select('id, name, slug, is_active, product_categories(count)')
      .eq('tenant_id', tenantId)
      .order('position')
      .order('name'),
    'categories',
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    productCount: row.product_categories[0]?.count ?? 0,
  }));
}
