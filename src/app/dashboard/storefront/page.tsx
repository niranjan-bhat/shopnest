import { Palette } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { PublishBar } from '@/components/dashboard/storefront/publish-bar';
import { ThemeLookForm } from '@/components/dashboard/storefront/theme-look-form';
import { Skeleton } from '@/components/ui/skeleton';
import { requireStore } from '@/features/tenants/access';
import { getThemeEditor } from '@/features/theme/editor';
import { lookOf } from '@/features/theme/look';
import { isR2Configured } from '@/lib/r2';

export const metadata: Metadata = { title: 'Storefront' };

async function StorefrontEditor() {
  const { store } = await requireStore('/dashboard/storefront');
  const editor = await getThemeEditor(store.id);
  const header = (
    <PageHeader
      title="Storefront"
      description="Your logo, colours and fonts. Changes stay in a draft until you publish."
    />
  );
  if (!editor) {
    return (
      <div className="grid gap-6">
        {header}
        <EmptyState
          icon={Palette}
          title="No theme yet"
          description="This store's theme has not been set up. Ask the Zarify team to set it up."
        />
      </div>
    );
  }
  const look = lookOf(editor.draft);
  return (
    <div className="grid gap-6">
      {header}
      <PublishBar
        hasChanges={editor.hasChanges}
        publishedAt={editor.publishedAt}
        canDiscard={editor.published !== null}
      />
      <ThemeLookForm
        // Restarts from fresh values when the draft changes elsewhere
        // (discard, another tab), not after its own saves.
        key={JSON.stringify(look)}
        initial={look}
        storeName={store.name}
        uploadsEnabled={isR2Configured()}
      />
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <StorefrontEditor />
    </Suspense>
  );
}
