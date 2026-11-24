import { Palette } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { EditorStatusProvider } from '@/components/dashboard/storefront/editor-status';
import { BannerLibrary } from '@/components/dashboard/storefront/banner-library';
import { HomeSections } from '@/components/dashboard/storefront/home-sections';
import { PublishBar } from '@/components/dashboard/storefront/publish-bar';
import { ThemeLookForm } from '@/components/dashboard/storefront/theme-look-form';
import { Skeleton } from '@/components/ui/skeleton';
import { requireOwner } from '@/features/tenants/access';
import { listDashboardBanners } from '@/features/theme/banner-queries';
import { getThemeEditor } from '@/features/theme/editor';
import { lookOf } from '@/features/theme/look';
import { allowedSectionTypes } from '@/features/theme/sections';
import { isR2Configured } from '@/lib/r2';
import { getTemplate } from '@/templates/registry';

export const metadata: Metadata = { title: 'Storefront' };

async function StorefrontEditor() {
  const { store } = await requireOwner('/dashboard/storefront');
  const editor = await getThemeEditor(store.id);
  const banners = await listDashboardBanners(store.id, editor);
  const uploadsEnabled = isR2Configured();
  const header = (
    <PageHeader
      title="Storefront"
      description="Your logo, colours, fonts, home page and banners. Look and home page changes stay in a draft until you publish."
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
    <EditorStatusProvider>
      <div className="grid gap-6">
        {header}
        <PublishBar
          hasChanges={editor.hasChanges}
          publishedAt={editor.publishedAt}
          hasPublished={editor.published !== null}
        />
        <ThemeLookForm
          // Restarts from fresh values when the draft changes elsewhere
          // (discard, another tab), not after its own saves.
          key={JSON.stringify(look)}
          initial={look}
          storeName={store.name}
          uploadsEnabled={uploadsEnabled}
        />
        <HomeSections
          sections={editor.draft.sections}
          banners={banners}
          allowed={allowedSectionTypes(
            getTemplate(editor.draft.templateKey).sections,
          )}
        />
        <BannerLibrary banners={banners} uploadsEnabled={uploadsEnabled} />
      </div>
    </EditorStatusProvider>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <StorefrontEditor />
    </Suspense>
  );
}
