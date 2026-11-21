'use client';

import { CircleUser, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
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
import { signOut } from '@/features/auth/actions';

export function AccountMenu({
  email,
  superAdmin,
}: {
  email: string;
  superAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Account"
            disabled={pending}
          />
        }
      >
        <CircleUser aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-xs">Signed in as</span>
            <span className="block truncate font-medium text-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {superAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck aria-hidden />
            Super admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
