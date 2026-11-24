import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageEditor } from '@/components/dashboard/settings/page-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { isPageSlug } from '@/features/pages/content';
import { listEditablePages } from '@/features/pages/dashboard';
import { requireOwner } from '@/features/tenants/access';

export const metadata: Metadata = { title: 'Edit page' };

type Props = PageProps<'/dashboard/settings/pages/[slug]'>;

async function EditPage({ params }: Pick<Props, 'params'>) {
  const { slug } = await params;
  const { store } = await requireOwner(`/dashboard/settings/pages/${slug}`);
  if (!isPageSlug(slug)) notFound();
  const page = (await listEditablePages(store.id)).find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <PageEditor
      // A save changes updatedAt, so the form restarts from the saved page.
      key={`${store.id}:${page.updatedAt}`}
      slug={slug}
      initial={{
        title: page.title,
        body: page.body,
        isPublished: page.isPublished,
      }}
      liveUrl={
        page.isPublished && store.url ? `${store.url}/pages/${slug}` : null
      }
    />
  );
}

export default function EditPageRoute(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <EditPage params={props.params} />
    </Suspense>
  );
}
