import type { Metadata } from 'next';
import { SALES_PHONE_LABEL, salesLink } from '@/features/marketing/site';

export const metadata: Metadata = {
  title: 'Terms',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <article className="mk-wrap mk-text">
      <h1 className="mk-display mk-h2">Terms</h1>
      <p>Last updated 24 November 2026</p>
      <p>These terms are for shops that use Zarify.</p>
      <h2>What we provide</h2>
      <p>
        An online store at a zarify.in address, a dashboard to run it, and
        orders sent to your WhatsApp. Your plan sets limits such as the number
        of products.
      </p>
      <h2>Fees</h2>
      <p>
        We agree the setup and monthly fees with you before your store goes
        live. If a payment stays overdue we may suspend the store until it is
        paid.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>
          Sell only what you may legally sell, and describe it truthfully.
        </li>
        <li>Use only photos and names you have the right to use.</li>
        <li>
          Handle your own orders, payments, delivery, returns and taxes. You,
          not Zarify, are the seller.
        </li>
        <li>Use shoppers’ details only to serve them.</li>
        <li>Keep access to your sign-in email secure.</li>
      </ul>
      <h2>Your content</h2>
      <p>
        Your products, photos and brand stay yours. You let us show them in
        order to run your store.
      </p>
      <h2>Suspension and leaving</h2>
      <p>
        We may suspend a store that breaks these terms or the law. You can stop
        at any time by messaging us.
      </p>
      <h2>Availability</h2>
      <p>
        We work to keep stores running, but cannot promise that they will never
        be interrupted.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={salesLink}>WhatsApp {SALES_PHONE_LABEL}</a>
      </p>
    </article>
  );
}
