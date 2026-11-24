import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { inviteMessage } from '@/features/admin/invite';
import type { AdminStore } from '@/features/admin/queries';
import { BUSINESS_TYPES } from '@/features/admin/store-schema';
import { formatWhatsApp } from '@/features/tenants/settings';
import { waLink } from '@/lib/whatsapp';
import { switchStore } from '@/features/tenants/actions';
import { CopyButton } from './copy-button';
import { StoreStatusBadge } from './store-status-badge';
import { StoreStatusCard } from './store-status-card';
import { TeamCard } from './team-card';

const date = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kolkata',
});

/** One store in the admin area: its details, team and the owner's invite. */
export function StoreDetail({
  store,
  loginUrl,
  billing,
}: {
  store: AdminStore;
  loginUrl: string;
  billing: ReactNode;
}) {
  const address = store.url?.replace(/^https?:\/\//, '');
  const invitee = store.team.find((m) => m.role === 'owner' && !m.signedIn);
  const message = invitee
    ? inviteMessage({ storeName: store.name, email: invitee.email, loginUrl })
    : null;
  const details: [string, string][] = [
    ['Plan', store.planName ?? 'No plan'],
    [
      'Business',
      BUSINESS_TYPES.find((t) => t.value === store.businessType)?.label ??
        store.businessType,
    ],
    ['WhatsApp', formatWhatsApp(store.whatsappNumber)],
    ['Created', date.format(new Date(store.createdAt))],
  ];

  return (
    <div className="grid gap-6">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Stores
      </Link>
      <PageHeader
        title={store.name}
        description={
          store.status === 'active' && store.url ? (
            <a
              href={store.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {address}
            </a>
          ) : (
            address
          )
        }
        actions={
          <>
            <StoreStatusBadge status={store.status} />
            <form action={switchStore}>
              <input type="hidden" name="storeId" value={store.id} />
              <Button type="submit" variant="outline">
                View as merchant
              </Button>
            </form>
          </>
        }
      />

      {message && invitee && (
        <Card data-testid="owner-invite">
          <CardHeader>
            <CardTitle>Invite the owner</CardTitle>
            <p className="text-sm text-muted-foreground">
              {invitee.email} has access but has not signed in yet. Nothing has
              been emailed: send them this message. The WhatsApp button opens
              the store&apos;s own number.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <pre className="rounded-lg bg-muted p-4 font-sans text-sm whitespace-pre-wrap">
              {message}
            </pre>
            <div className="flex flex-wrap gap-2">
              <a
                href={waLink(store.whatsappNumber, message)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants()}
              >
                <MessageCircle aria-hidden />
                Send on WhatsApp
              </a>
              <CopyButton text={message} />
            </div>
          </CardContent>
        </Card>
      )}

      <StoreStatusCard
        key={`status:${store.id}`}
        storeId={store.id}
        status={store.status}
        missing={store.missing}
        suspendedReason={store.suspendedReason}
      />

      {billing}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <TeamCard
          key={`team:${store.id}`}
          storeId={store.id}
          storeName={store.name}
          team={store.team}
          loginUrl={loginUrl}
        />
      </div>
    </div>
  );
}
