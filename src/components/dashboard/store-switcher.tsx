'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { switchStore } from '@/features/tenants/actions';
import type { StoreRole } from '@/features/tenants/active-store';

export type SwitcherStore = { id: string; name: string; role: StoreRole };

/**
 * Shows the active store and, when the user has more than one, lets them
 * switch. Super admins also see every other store on the platform.
 */
export function StoreSwitcher({
  stores,
  activeId,
}: {
  stores: SwitcherStore[];
  activeId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const active = stores.find((store) => store.id === activeId);
  if (!active) return null;

  if (stores.length === 1) {
    return (
      <p className="truncate px-2 text-sm font-medium" data-testid="store-name">
        {active.name}
      </p>
    );
  }

  const own = stores.filter((store) => store.role !== 'admin');
  const others = stores.filter((store) => store.role === 'admin');

  const select = (id: string) => {
    if (id === activeId) return;
    const form = new FormData();
    form.set('storeId', id);
    startTransition(() => switchStore(form));
  };

  const group = (label: string, list: SwitcherStore[]) =>
    list.length > 0 && (
      <DropdownMenuGroup>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {list.map((store) => (
          <DropdownMenuItem key={store.id} onClick={() => select(store.id)}>
            <span className="truncate">{store.name}</span>
            {store.id === activeId && (
              <Check aria-label="Current store" className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="max-w-56 min-w-0 justify-between gap-2 font-medium"
            disabled={pending}
            aria-label={`Store: ${active.name}. Switch store`}
          />
        }
      >
        <span className="truncate" data-testid="store-name">
          {active.name}
        </span>
        <ChevronsUpDown aria-hidden className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {group('Your stores', own)}
        {own.length > 0 && others.length > 0 && <DropdownMenuSeparator />}
        {group('All stores (super admin)', others)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
