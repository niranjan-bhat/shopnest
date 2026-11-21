'use server';

import { refresh } from 'next/cache';
import { requireStoreForAction } from '@/features/tenants/access';
import type { ActionResult } from '@/lib/action-result';
import { createServerSupabase } from '@/lib/supabase/server';
import { catalogChanged } from './cache';
import {
  categoryFormSchema,
  categoryOrderSchema,
  categorySlug,
  categoryVisibilitySchema,
  idSchema,
  type CategoryField,
} from './schemas';

// Category changes from the dashboard. Each one checks the user may manage
// the active store, writes with an explicit tenant_id filter, then expires
// the store's cached catalog so the storefront shows the change.

const UNIQUE_VIOLATION = '23505';

/** Creates a category (id null) or updates one. */
export async function saveCategory(
  id: string | null,
  input: unknown,
): Promise<ActionResult<CategoryField>> {
  const { store } = await requireStoreForAction();
  const categoryId = id === null ? null : idSchema.safeParse(id);
  if (categoryId && !categoryId.success) {
    return { ok: false, error: 'That category no longer exists.' };
  }

  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CategoryField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as CategoryField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const slug = categorySlug(parsed.data);
  if (!slug) {
    return {
      ok: false,
      fieldErrors: {
        slug: 'Add a URL using English letters or numbers, e.g. sarees',
      },
    };
  }
  const row = {
    name: parsed.data.name,
    slug,
    is_active: parsed.data.isActive,
    show_in_menu: parsed.data.showInMenu,
  };

  const supabase = await createServerSupabase();
  let error: { code: string; message: string } | null;
  if (categoryId) {
    const result = await supabase
      .from('categories')
      .update(row)
      .eq('tenant_id', store.id)
      .eq('id', categoryId.data)
      .select('id');
    error = result.error;
    if (!error && (result.data ?? []).length === 0) {
      return { ok: false, error: 'That category no longer exists.' };
    }
  } else {
    const last = await supabase
      .from('categories')
      .select('position')
      .eq('tenant_id', store.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) throw new Error(last.error.message);
    const result = await supabase.from('categories').insert({
      ...row,
      tenant_id: store.id,
      position: (last.data?.position ?? -1) + 1,
    });
    error = result.error;
  }

  if (error?.code === UNIQUE_VIOLATION) {
    return {
      ok: false,
      fieldErrors: { slug: 'Another category already uses this URL.' },
    };
  }
  if (error) throw new Error(`Saving category failed: ${error.message}`);

  catalogChanged(store.id);
  return { ok: true };
}

/** Shows or hides a category on the storefront. */
export async function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = categoryVisibilitySchema.safeParse({ id, isActive });
  if (!parsed.success) {
    return { ok: false, error: 'That category no longer exists.' };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('categories')
    .update({ is_active: parsed.data.isActive })
    .eq('tenant_id', store.id)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) throw new Error(`Updating category failed: ${error.message}`);
  if (data.length === 0) {
    return { ok: false, error: 'That category no longer exists.' };
  }
  catalogChanged(store.id);
  return { ok: true };
}

/** Deletes a category. Its products stay; they just leave the category. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const categoryId = idSchema.safeParse(id);
  if (!categoryId.success) {
    return { ok: false, error: 'That category no longer exists.' };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('tenant_id', store.id)
    .eq('id', categoryId.data);
  if (error) throw new Error(`Deleting category failed: ${error.message}`);
  catalogChanged(store.id);
  return { ok: true };
}

/** Saves the order of all of the store's categories. */
export async function reorderCategories(ids: unknown): Promise<ActionResult> {
  const { store } = await requireStoreForAction();
  const parsed = categoryOrderSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'Could not save the new order.' };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('reorder_categories', {
    tid: store.id,
    ordered_ids: parsed.data,
  });
  if (error) {
    // 22023: the list was stale (a category was added or deleted meanwhile).
    if (error.code === '22023') {
      refresh();
      return {
        ok: false,
        error: 'Categories changed in another window. Try again.',
      };
    }
    throw new Error(`Reordering categories failed: ${error.message}`);
  }
  catalogChanged(store.id);
  return { ok: true };
}
