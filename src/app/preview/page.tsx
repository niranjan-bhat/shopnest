import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PublishButton } from '@/components/dashboard/storefront/publish-button';
import { StoreRoot } from '@/components/storefront/store-root';
import { buttonVariants } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { requireStore } from '@/features/tenants/access';
import { loadThemePreview } from '@/features/theme/preview';

export const metadata: Metadata = {
  title: 'Preview · Zarify',
  robots: { index: false },
};

/**
 * The active store's home page with its draft theme, for its team only.
 * On the app host, so it sits behind sign-in like the dashboard.
 */
async function Preview() {
  const { store, editingUntil } = await requireStore('/preview');
  const readOnly = store.role === 'admin' && editingUntil === null;
  const preview = await loadThemePreview(store);
  if (!preview) notFound();
  const { template } = preview;

  return (
    <>
      <div
        className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2 font-sans text-sm text-foreground"
        data-testid="preview-bar"
      >
        <Link
          href="/dashboard/storefront"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft aria-hidden />
          Back to editor
        </Link>
        <p className="min-w-0 flex-1 truncate">
          <strong>Preview of {store.name}.</strong>{' '}
          {preview.hasChanges
            ? 'Shoppers do not see these changes until you publish.'
            : 'This is what shoppers see now.'}
        </p>
        {store.url && (
          <a
            href={store.url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink aria-hidden />
            Live store
          </a>
        )}
        <PublishButton size="sm" disabled={readOnly || !preview.hasChanges} />
      </div>
      <StoreRoot
        store={preview.store}
        theme={preview.theme}
        template={template}
      >
        <template.HomePage store={preview.store} sections={preview.sections} />
      </StoreRoot>
      <Toaster position="top-center" />
    </>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-muted-foreground">Loading preview…</p>}
    >
      <Preview />
    </Suspense>
  );
}
