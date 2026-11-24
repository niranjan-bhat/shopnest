'use server';

import { updateTag } from 'next/cache';
import { requireSuperAdminForAction } from '@/features/auth/session';
import { hostTag } from '@/features/tenants/queries';
import { DEFAULT_THEME } from '@/features/theme/defaults';
import { getPublicEnv } from '@/lib/env.public';
import { adminDb } from '@/lib/supabase/admin';
import { normalizeHostname } from '@/lib/tenant';
import { ensureAccount } from './accounts';
import {
  createStoreResultSchema,
  newStoreSchema,
  type NewStoreField,
} from './store-schema';

type CreateStoreResult =
  | { ok: true; storeId: string }
  | { ok: false; fieldErrors: Partial<Record<NewStoreField, string>> };

/**
 * Creates a store that is not live yet: its subdomain, draft theme, owner
 * and subscription, all or nothing (create_store in the database).
 */
export async function createStore(input: unknown): Promise<CreateStoreResult> {
  const admin = await requireSuperAdminForAction();
  const parsed = newStoreSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<NewStoreField, string>> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as NewStoreField] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const store = parsed.data;
  const root = normalizeHostname(getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN);
  if (!root) throw new Error('Invalid root domain');

  await ensureAccount(store.ownerEmail);
  const { data, error } = await adminDb().rpc('create_store', {
    actor: admin.id,
    root,
    store: {
      name: store.name,
      slug: store.slug,
      business_type: store.businessType,
      whatsapp_number: store.whatsappNumber,
      owner_email: store.ownerEmail,
      template_key: store.templateKey,
      plan_id: store.planId,
      theme: { ...DEFAULT_THEME, templateKey: store.templateKey },
    },
  });
  if (error?.message === 'unknown plan') {
    return {
      ok: false,
      fieldErrors: { planId: 'This plan is no longer available' },
    };
  }
  if (error?.message === 'unknown template') {
    return {
      ok: false,
      fieldErrors: { templateKey: 'This template is no longer available' },
    };
  }
  if (error) throw new Error(`Creating the store failed: ${error.message}`);

  const result = createStoreResultSchema.parse(data);
  if (result.status === 'taken') {
    return { ok: false, fieldErrors: { slug: 'This address is taken' } };
  }
  // A visit before now cached "no store at this address".
  updateTag(hostTag(`${store.slug}.${root}`));
  return { ok: true, storeId: result.tenant_id };
}
