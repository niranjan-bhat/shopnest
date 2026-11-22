import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StoreSettingsForm } from '@/components/dashboard/settings/store-settings-form';
import { Skeleton } from '@/components/ui/skeleton';
import { requireStore } from '@/features/tenants/access';
import { settingsFormValues } from '@/features/tenants/settings';
import { getStoreSettings } from '@/features/tenants/settings-queries';

export const metadata: Metadata = { title: 'Settings' };

async function Settings() {
  const { store } = await requireStore('/dashboard/settings');
  const initial = settingsFormValues(await getStoreSettings(store.id));
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Your store's name, WhatsApp number and contact details. Changes go live when you save."
      />
      <StoreSettingsForm
        // Restarts from the saved values after each save or store switch.
        key={`${store.id}:${JSON.stringify(initial)}`}
        initial={initial}
        storeUrl={store.url}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Settings />
    </Suspense>
  );
}
