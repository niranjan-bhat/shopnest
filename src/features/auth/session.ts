import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { check } from '@/lib/supabase/result';
import { createServerSupabase } from '@/lib/supabase/server';

export type SessionUser = { id: string; email: string };

/** The signed-in user, verified with Supabase Auth, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: String(data.claims.email ?? '') };
}

/** The signed-in user; anyone else is sent to /login and back afterwards. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createServerSupabase();
  return check(await supabase.rpc('is_super_admin'), 'is_super_admin') === true;
}

/**
 * A signed-in super admin. Signed-out visitors go to /login; other users get
 * a 404 so the admin area does not advertise itself.
 */
export async function requireSuperAdmin(
  returnTo: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!(await isSuperAdmin())) notFound();
  return user;
}
