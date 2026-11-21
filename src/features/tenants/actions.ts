'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSessionUser } from '@/features/auth/session';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';
import { ACTIVE_STORE_COOKIE } from './active-store';

const switchStoreSchema = z.object({ storeId: z.uuid() });

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Makes another store the active one, if the user may open it. */
export async function switchStore(formData: FormData): Promise<void> {
  const parsed = switchStoreSchema.safeParse({
    storeId: formData.get('storeId'),
  });
  if (!parsed.success) return;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=%2Fdashboard');

  const supabase = await createServerSupabase();
  const allowed = check(
    await supabase.rpc('can_manage_tenant', { tid: parsed.data.storeId }),
    'can_manage_tenant',
  );
  if (allowed !== true) return;

  (await cookies()).set(ACTIVE_STORE_COOKIE, parsed.data.storeId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
  redirect('/dashboard');
}
