import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AdminAccount } from '@/components/admin/admin-account';
import { buttonVariants } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: { default: 'Super admin', template: '%s · Zarify admin' },
  robots: { index: false },
};

/**
 * Super admin shell. It protects nothing: layouts and pages render in
 * parallel, so every page and action checks access itself.
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 md:px-8">
          <Link href="/admin" className="font-semibold tracking-tight">
            Zarify <span className="text-muted-foreground">admin</span>
          </Link>
          <nav aria-label="Admin" className="ml-2 flex items-center gap-1">
            <Link
              href="/admin"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Stores
            </Link>
            <Link
              href="/admin/plans"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Plans
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Dashboard
            </Link>
            <Suspense fallback={null}>
              <AdminAccount />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
