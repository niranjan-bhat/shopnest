import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Brand } from '@/components/dashboard/brand';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { NavLinks, NavList } from '@/components/dashboard/nav-links';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Zarify' },
  robots: { index: false },
};

/**
 * Dashboard shell: sidebar navigation (a slide-in menu on phones) and a
 * header with the store switcher and account menu. The shell does not
 * protect anything: layouts and pages render in parallel, so every page and
 * action checks access itself (features/tenants/access.ts).
 */
export default function DashboardLayout({
  children,
}: LayoutProps<'/dashboard'>) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 shrink-0 items-center border-b px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {/* The highlight depends on the URL, which is only known per
              request on routes like /dashboard/products/[id]. */}
          <Suspense fallback={<NavList pathname={null} />}>
            <NavLinks />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-6">
          <MobileNav />
          <Suspense fallback={<Skeleton className="h-6 w-40" />}>
            <DashboardHeader />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
