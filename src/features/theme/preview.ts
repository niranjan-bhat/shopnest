import 'server-only';
import { listCategories } from '@/features/catalog/queries';
import {
  resolveHomeSections,
  type ResolvedSection,
} from '@/features/storefront/home';
import type { StoreChoice } from '@/features/tenants/active-store';
import { CONTACT_COLUMNS, toStoreContact } from '@/features/tenants/settings';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import type { StoreContext, TemplateDefinition } from '@/templates/contract';
import { getTemplate } from '@/templates/registry';
import { getThemeEditor } from './editor';
import type { ThemeConfig } from './schema';

export type ThemePreview = {
  store: StoreContext;
  theme: ThemeConfig;
  template: TemplateDefinition;
  sections: ResolvedSection[];
  hasChanges: boolean;
};

/**
 * The store's home page as it will look with the draft theme. Catalog data
 * is the live data (only the theme is a draft). Links go to the live store,
 * so they open pages with the published theme.
 */
export async function loadThemePreview(
  store: StoreChoice,
): Promise<ThemePreview | null> {
  const supabase = await createServerSupabase();
  const [editor, tenant, categories] = await Promise.all([
    getThemeEditor(store.id),
    supabase
      .from('tenants')
      .select(`whatsapp_number, ${CONTACT_COLUMNS}`)
      .eq('id', store.id)
      .single(),
    listCategories(store.id),
  ]);
  if (!editor) return null;
  const tenantRow = check(tenant, 'tenants');
  const theme = editor.draft;
  const template = getTemplate(theme.templateKey);
  const sections = await resolveHomeSections(
    store.id,
    theme.sections,
    template.sections,
  );
  return {
    theme,
    template,
    sections,
    hasChanges: editor.hasChanges,
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      whatsappNumber: tenantRow.whatsapp_number,
      contact: toStoreContact(tenantRow),
      branding: theme.branding,
      announcement: theme.announcement ?? null,
      basePath: store.url ?? '',
      categories,
    },
  };
}
