import type { Metadata } from 'next';
import { DM_Serif_Display, Mukta } from 'next/font/google';
import Link from 'next/link';
import '@/components/marketing/marketing.css';
import {
  loginUrl,
  SALES_PHONE_LABEL,
  salesLink,
  siteOrigin,
} from '@/features/marketing/site';

const display = DM_Serif_Display({
  variable: '--font-display',
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
});
const body = Mukta({
  variable: '--font-mukta',
  weight: ['400', '700'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'Zarify: online stores for saree shops and boutiques',
    template: '%s · Zarify',
  },
  description:
    'Your boutique’s own online store, with prices, sizes and stock. Orders come to your WhatsApp.',
  openGraph: { siteName: 'Zarify', type: 'website', locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className={`marketing ${display.variable} ${body.variable}`}>
      <header className="mk-header">
        <div className="mk-wrap flex h-16 items-center gap-5">
          <Link href="/" className="mk-display mk-logo text-3xl">
            Zarify
          </Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-5">
            <Link href="/#demos" className="hidden sm:inline">
              Demo stores
            </Link>
            <Link href="/#pricing" className="hidden sm:inline">
              Pricing
            </Link>
            <a href={loginUrl()} className="mk-signin">
              Sign in
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mk-footer">
        <div className="mk-wrap flex flex-wrap items-center gap-x-6 gap-y-3 py-8">
          <span className="mk-display text-xl">Zarify</span>
          <a href={salesLink}>WhatsApp {SALES_PHONE_LABEL}</a>
          <span className="flex gap-6 sm:ml-auto">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
