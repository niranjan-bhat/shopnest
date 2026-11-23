import { AccountMenu } from '@/components/dashboard/account-menu';
import { getSessionUser, isSuperAdmin } from '@/features/auth/session';

/** The account menu in the admin header. Empty when signed out. */
export async function AdminAccount() {
  const user = await getSessionUser();
  if (!user) return null;
  return <AccountMenu email={user.email} superAdmin={await isSuperAdmin()} />;
}
