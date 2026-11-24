import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { PlanCard } from '@/components/dashboard/settings/plan-card';
import { StorePagesList } from '@/components/dashboard/settings/store-pages-list';
import { StoreSettingsForm } from '@/components/dashboard/settings/store-settings-form';
import { Skeleton } from '@/components/ui/skeleton';
import { listEditablePages } from '@/features/pages/dashboard';
import { getStorePlan, getUsage } from '@/features/billing/queries';
import { requireStore } from '@/features/tenants/access';
import { settingsFormValues } from '@/features/tenants/settings';
import { getStoreSettings } from '@/features/tenants/settings-queries';

export const metadata: Metadata = { title: 'Settings' };

async function Settings() {
  const { store } = await requireStore('/dashboard/settings');
  const [settings, pages, subscription, usage] = await Promise.all([
    getStoreSettings(store.id),
    listEditablePages(store.id),
    getStorePlan(store.id),
    getUsage(store.id),
  ]);
  const initial = settingsFormValues(settings);
  return (
    // Room at the bottom for the form's fixed save bar.
    <div className="grid gap-6 pb-24">
      <PageHeader
        title="Settings"
        description="Your store's name, WhatsApp number, contact details and pages. Changes go live when you save."
      />
      <StoreSettingsForm
        // Restarts from the saved values after each save or store switch.
        key={`${store.id}:${JSON.stringify(initial)}`}
        initial={initial}
        storeUrl={store.url}
      />
      <StorePagesList pages={pages} />
      {subscription && <PlanCard subscription={subscription} usage={usage} />}
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
