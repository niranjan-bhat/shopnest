import { FolderTree } from 'lucide-react';
import type { Metadata } from 'next';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return (
    <SectionPlaceholder
      path="/dashboard/categories"
      title="Categories"
      description="How products are grouped in your store's menu."
      icon={FolderTree}
      upcoming="Creating and reordering categories is the next part of the dashboard."
    />
  );
}
