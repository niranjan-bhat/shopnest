import { Settings } from 'lucide-react';
import type { Metadata } from 'next';
import { SectionPlaceholder } from '@/components/dashboard/section-placeholder';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      path="/dashboard/settings"
      title="Settings"
      description="Store name, WhatsApp number, address and policies."
      icon={Settings}
      upcoming="Store details and policy pages are coming soon."
    />
  );
}
