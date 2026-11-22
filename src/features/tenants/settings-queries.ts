import 'server-only';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { CONTACT_COLUMNS, toStoreContact, type StoreContact } from './settings';

export type StoreSettings = {
  name: string;
  /** E.164. */
  whatsappNumber: string;
  contact: StoreContact;
};

/** The active store's details for the Settings page (as the member). */
export async function getStoreSettings(
  tenantId: string,
): Promise<StoreSettings> {
  const supabase = await createServerSupabase();
  const row = check(
    await supabase
      .from('tenants')
      .select(`name, whatsapp_number, ${CONTACT_COLUMNS}`)
      .eq('id', tenantId)
      .single(),
    'tenants',
  );
  return {
    name: row.name,
    whatsappNumber: row.whatsapp_number,
    contact: toStoreContact(row),
  };
}
