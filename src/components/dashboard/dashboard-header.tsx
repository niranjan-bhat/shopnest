import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getDashboardContext } from '@/features/tenants/access';
import { AccountMenu } from './account-menu';
import { StoreSwitcher } from './store-switcher';

const STATUS_LABEL = { onboarding: 'Not live yet', suspended: 'Suspended' };

/** Store switcher, store link and account menu. Empty when signed out. */
export async function DashboardHeader() {
  const context = await getDashboardContext();
  if (!context) return null;
  const { store } = context;
  return (
    <>
      <StoreSwitcher
        stores={context.stores.map(({ id, name, role }) => ({
          id,
          name,
          role,
        }))}
        activeId={store?.id ?? null}
      />
      {store && store.status !== 'active' && (
        <Badge
          variant={store.status === 'suspended' ? 'destructive' : 'outline'}
        >
          {STATUS_LABEL[store.status]}
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-1">
        {store?.url && (
          <a
            href={store.url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink aria-hidden />
            <span className="sr-only sm:not-sr-only">View store</span>
          </a>
        )}
        <AccountMenu
          email={context.user.email}
          superAdmin={context.superAdmin}
        />
      </div>
    </>
  );
}
