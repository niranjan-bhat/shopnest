import type { Metadata } from 'next';
import { SALES_PHONE_LABEL, salesLink } from '@/features/marketing/site';

export const metadata: Metadata = {
  title: 'Privacy',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <article className="mk-wrap mk-text">
      <h1 className="mk-display mk-h2">Privacy</h1>
      <p>Last updated 24 November 2026</p>
      <p>
        Zarify runs online stores for shops in India. This page says what
        personal information we handle and why.
      </p>
      <h2>If you run a store</h2>
      <p>
        We keep your email address to sign you in, your store’s details,
        products and orders, your team’s email addresses, and a record of your
        payments to us.
      </p>
      <h2>If you shop at a store</h2>
      <p>
        When you place an order, we save your name, mobile number, delivery
        address, notes and what you ordered. The store you ordered from uses
        them to deliver it. To limit fake orders we also keep a scrambled form
        of your network address.
      </p>
      <p>
        Your bag and checkout details may be kept in your own browser. The order
        message is sent through WhatsApp, which has its own privacy policy.
      </p>
      <h2>Who handles it for us</h2>
      <p>
        We use companies that host the stores, database and photos and that send
        sign-in emails: Vercel, Supabase, Cloudflare and Resend. Our database is
        in Mumbai. We do not sell personal information.
      </p>
      <h2>Cookies</h2>
      <p>We use cookies to keep store owners signed in.</p>
      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete your information. Ask the store
        you ordered from, or message us on{' '}
        <a href={salesLink}>WhatsApp at {SALES_PHONE_LABEL}</a>. We may need to
        keep some records where the law requires it.
      </p>
    </article>
  );
}
