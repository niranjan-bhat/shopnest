import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  addressLines,
  directionsUrl,
  formatWhatsApp,
} from '@/features/tenants/settings';
import { waLink } from '@/lib/whatsapp';
import type { StorePageProps } from '../contract';
import { SectionHeading } from './section-heading';

const button =
  'inline-flex items-center gap-2 rounded-store px-6 py-3 text-xs font-medium tracking-[0.16em] uppercase transition-opacity hover:opacity-90';

function Block({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 text-store-primary" aria-hidden>
        {icon}
      </span>
      <div>
        <h2 className="text-xs tracking-[0.18em] text-store-muted uppercase">
          {title}
        </h2>
        <div className="mt-2 text-lg leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** How to reach the store. Shows only what the merchant has filled in. */
export function SilkContactPage({ store }: StorePageProps) {
  const { address, phone, email, openingHours } = store.contact;
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 md:px-8">
      <SectionHeading
        as="h1"
        title="Contact us"
        subtitle="Questions about a piece, sizing or delivery? We are happy to help."
        className="mb-14"
      />
      <div className="grid gap-10 md:grid-cols-2">
        <Block icon={<MessageCircle className="size-5" />} title="WhatsApp">
          <p>{formatWhatsApp(store.whatsappNumber)}</p>
          <a
            href={waLink(store.whatsappNumber, `Hi ${store.name}, `)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${button} mt-4 bg-store-primary text-store-on-primary`}
          >
            Chat on WhatsApp
          </a>
        </Block>
        {address && (
          <Block icon={<MapPin className="size-5" />} title="Visit us">
            <address className="not-italic">
              {addressLines(address).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <a
              href={directionsUrl(store.name, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-base text-store-primary underline underline-offset-4"
            >
              Get directions
            </a>
          </Block>
        )}
        {openingHours && (
          <Block icon={<Clock className="size-5" />} title="Opening hours">
            <p>{openingHours}</p>
          </Block>
        )}
        {phone && (
          <Block icon={<Phone className="size-5" />} title="Call us">
            <a
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="underline-offset-4 hover:underline"
            >
              {phone}
            </a>
          </Block>
        )}
        {email && (
          <Block icon={<Mail className="size-5" />} title="Email">
            <a
              href={`mailto:${email}`}
              className="break-all underline-offset-4 hover:underline"
            >
              {email}
            </a>
          </Block>
        )}
      </div>
    </div>
  );
}
