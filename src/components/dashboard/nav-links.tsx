'use client';

import { cn } from 'cn';
import {
  FolderTree,
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only the exact path counts as active (the overview). */
  exact?: boolean;
  /** Shown but not clickable until its phase ships. */
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/categories', label: 'Categories', icon: FolderTree },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag, soon: true },
  { href: '/dashboard/storefront', label: 'Storefront', icon: Palette },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (pathname === null) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const itemClass =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';

/**
 * The dashboard's main navigation, used in the sidebar and the phone menu.
 * It reads the URL to highlight the current section; in a server-rendered
 * layout, wrap it in <Suspense fallback={<NavList pathname={null} />}>
 * (Cache Components requires that on routes with params).
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

/** The links themselves; `pathname` null highlights nothing. */
export function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Dashboard">
      <ul className="grid gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.soon) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  className={cn(itemClass, 'text-muted-foreground/60')}
                >
                  <Icon aria-hidden className="size-4" />
                  {item.label}
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </span>
              </li>
            );
          }
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  itemClass,
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
