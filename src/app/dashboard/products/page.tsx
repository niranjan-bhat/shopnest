import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return (
    <SectionPlaceholder
      path="/dashboard/products"
      title="Products"
      description="Everything you sell, with prices, sizes and stock."
      icon={Package}
      upcoming="Adding and editing products is the next part of the dashboard."
    />
  );
}
