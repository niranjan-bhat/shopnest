import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { Monogram } from '@/components/marketing/logo';
import '@/components/marketing/marketing.css';
import {
  loginUrl,
  SALES_PHONE_LABEL,
  salesLink,
  siteOrigin,
} from '@/features/marketing/site';

const heading = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
});
const body = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'Zarify: online stores for fashion brands',
    template: '%s · Zarify',
  },
  description:
    'Showcase your collections, manage inventory and receive orders on WhatsApp. We handle the setup.',
  openGraph: { siteName: 'Zarify', type: 'website', locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#demos', label: 'Demo stores' },
  { href: '/#pricing', label: 'Pricing' },
];

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className={`marketing ${heading.variable} ${body.variable}`}>
      <header className="mk-header">
        <nav
          aria-label="Main"
          className="mk-wrap flex h-18 items-center gap-4 sm:gap-6"
        >
          <Link href="/" className="mk-logo">
            <Monogram className="size-8" />
            Zarify
          </Link>
          <span className="ml-10 hidden gap-8 lg:flex">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </span>
          <a href={loginUrl()} className="ml-auto">
            Sign in
          </a>
          <a href={salesLink} className="mk-btn mk-btn-small">
            Get started
          </a>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mk-footer">
        <div className="mk-wrap flex flex-wrap items-center gap-x-8 gap-y-3 py-10">
          <span className="mk-logo mr-auto">
            <Monogram className="size-7" />
            Zarify
          </span>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="lg:hidden!">
              {link.label}
            </Link>
          ))}
          <a href={salesLink}>WhatsApp {SALES_PHONE_LABEL}</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
