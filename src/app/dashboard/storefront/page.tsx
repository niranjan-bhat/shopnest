import { Palette } from 'lucide-react';
import type { Metadata } from 'next';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';

export const metadata: Metadata = { title: 'Storefront' };

export default function StorefrontPage() {
  return (
    <SectionPlaceholder
      path="/dashboard/storefront"
      title="Storefront"
      description="Your logo, colours, fonts, banners and home page."
      icon={Palette}
      upcoming="The storefront editor, with preview and publish, is coming soon."
    />
  );
}
