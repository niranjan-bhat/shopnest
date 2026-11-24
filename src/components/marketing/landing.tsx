import {
  ArrowRight,
  Boxes,
  LayoutGrid,
  MessageCircle,
  Palette,
} from 'lucide-react';
import Image, { type StaticImageData } from 'next/image';
import boutiqueWide from '@/assets/marketing/boutique-wide.jpg';
import deskInventory from '@/assets/marketing/desk-inventory.jpg';
import deskOrders from '@/assets/marketing/desk-orders.jpg';
import deskProducts from '@/assets/marketing/desk-products.jpg';
import sareeWide from '@/assets/marketing/laptop.jpg';
import phoneInventory from '@/assets/marketing/phone-inventory.jpg';
import phoneOrders from '@/assets/marketing/phone-orders.jpg';
import phoneProducts from '@/assets/marketing/phone-products.jpg';
import productShot from '@/assets/marketing/product.jpg';
import { DEMOS, demoUrl, salesLink } from '@/features/marketing/site';

const DEMO_SHOTS = { 'saree-demo': sareeWide, 'boutique-demo': boutiqueWide };

const FEATURES = [
  {
    icon: Palette,
    title: 'Your own store',
    text: 'Your brand. Your identity.',
  },
  {
    icon: LayoutGrid,
    title: 'Product catalog',
    text: 'Manage collections easily.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp orders',
    text: 'Receive orders directly.',
  },
  { icon: Boxes, title: 'Inventory', text: 'Stay on top of stock.' },
];

const STEPS = [
  { title: 'Message us', text: 'Tell us about your brand on WhatsApp.' },
  { title: 'We set up your store', text: 'Sign in and add your products.' },
  { title: 'Share your link', text: 'Orders arrive on your WhatsApp.' },
];

const FAQ = [
  {
    question: 'How do my customers pay?',
    answer:
      'You agree it with them on WhatsApp: UPI, bank transfer or cash on delivery. Online payment inside the store is not available yet.',
  },
  {
    question: 'What will my website be called?',
    answer:
      'You choose a name and your store is at name.zarify.in. Using a domain you already own is not available yet.',
  },
  {
    question: 'What photos do I need?',
    answer:
      'The ones you post on Instagram are fine, as long as they are yours to use. Clear, full-length photos work best.',
  },
  {
    question: 'Do I need a computer?',
    answer:
      'No. You can add products, change stock and see orders in your phone’s browser.',
  },
];

/** Sign-up is a WhatsApp chat: stores are set up by the Zarify team. */
function GetStarted({ gold = false }: { gold?: boolean }) {
  return (
    <a
      href={salesLink}
      className={gold ? 'mk-btn mk-btn-gold' : 'mk-btn'}
      aria-label="Get started on WhatsApp"
    >
      Get started
      <ArrowRight aria-hidden className="mk-arrow size-4" />
    </a>
  );
}

/** A dashboard screen: the desktop layout, or the phone layout on phones. */
function Screen({
  title,
  text,
  wide,
  phone,
  large = false,
}: {
  title: string;
  text: string;
  wide: StaticImageData;
  phone: StaticImageData;
  large?: boolean;
}) {
  return (
    <figure className={large ? 'md:col-span-2' : undefined}>
      <div className="mk-window">
        <Image
          src={wide}
          alt={`${title} in the Zarify dashboard`}
          sizes={large ? '(min-width: 80rem) 76rem, 94vw' : '60vw'}
          className={
            large
              ? 'hidden md:block'
              : 'hidden aspect-[956/700] object-cover object-right md:block'
          }
        />
        <Image
          src={phone}
          alt={`${title} in the Zarify dashboard on a phone`}
          sizes="92vw"
          className="md:hidden"
        />
      </div>
      <figcaption className="mt-5">
        <span className="mk-h3">{title}</span>
        <span className="block text-(--soft)">{text}</span>
      </figcaption>
    </figure>
  );
}

/** The platform's home page. */
export function Landing() {
  return (
    <>
      <section className="mk-hero">
        <div className="mk-wrap grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1fr_1.2fr] lg:py-28">
          <div className="mk-rise">
            <p className="mk-label">Built for fashion brands</p>
            <h1 className="mk-h1 mt-5">
              Your brand. <span className="whitespace-nowrap">Your store.</span>{' '}
              <span className="block text-(--gold)">Now online.</span>
            </h1>
            <p className="mt-6 max-w-[29rem] text-lg leading-relaxed text-(--soft) md:text-xl md:leading-relaxed">
              Showcase your collections, manage inventory and receive orders on
              WhatsApp.
            </p>
            <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
              <GetStarted />
              <a href="#demos" className="mk-btn mk-btn-quiet">
                Explore demo stores
              </a>
            </div>
            <p className="mt-5 text-sm text-(--soft)">
              No coding. We handle the setup.
            </p>
          </div>
          <div className="mk-devices mk-rise mk-rise-late">
            <div className="mk-laptop">
              <div className="mk-screen">
                <Image
                  src={sareeWide}
                  alt="A demo store, Tara Weaves, on a laptop"
                  sizes="(min-width: 64rem) 40rem, 92vw"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
            <div className="mk-phone">
              <Image
                src={productShot}
                alt="A product page in the demo store, on a phone"
                sizes="13rem"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mk-wrap mk-anchor py-16 md:py-24">
        <h2 className="sr-only">Features</h2>
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 lg:block">
              <Icon
                aria-hidden
                className="size-7 shrink-0 text-(--gold)"
                strokeWidth={1.5}
              />
              <div className="lg:mt-5">
                <h3 className="mk-h3">{title}</h3>
                <p className="mt-1 text-(--soft)">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mk-ivory py-20 md:py-32">
        <div className="mk-wrap">
          <h2 className="mk-h2 max-w-[18ch]">
            Everything you need to run your store.
          </h2>
          <div className="mt-12 grid gap-x-8 gap-y-14 md:mt-16 md:grid-cols-2">
            <Screen
              large
              title="Products"
              text="Your whole collection in one place."
              wide={deskProducts}
              phone={phoneProducts}
            />
            <Screen
              title="Orders"
              text="From new to delivered."
              wide={deskOrders}
              phone={phoneOrders}
            />
            <Screen
              title="Inventory"
              text="Stock for every product."
              wide={deskInventory}
              phone={phoneInventory}
            />
          </div>
        </div>
      </section>

      <section id="demos" className="mk-wrap mk-anchor py-20 md:py-32">
        <h2 className="mk-h2">See it for yourself.</h2>
        <p className="mt-4 text-lg text-(--soft)">
          Two demo stores you can browse.
        </p>
        <ul className="mt-12 grid gap-x-8 gap-y-12 md:mt-16 md:grid-cols-2">
          {DEMOS.map((demo) => (
            <li key={demo.slug}>
              <a href={demoUrl(demo.slug)} className="mk-demo">
                <span className="mk-window block">
                  <Image
                    src={DEMO_SHOTS[demo.slug]}
                    alt=""
                    sizes="(min-width: 48rem) 46vw, 92vw"
                  />
                </span>
                <span className="mt-5 flex items-center justify-between gap-4">
                  <span>
                    <span className="mk-h3 block">{demo.name}</span>
                    <span className="text-(--soft)">{demo.kind} (demo)</span>
                  </span>
                  <ArrowRight aria-hidden className="mk-arrow size-5" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mk-ivory py-20 md:py-28">
        <div className="mk-wrap grid gap-16 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
          <div>
            <h2 className="mk-h2">How it works</h2>
            <ol className="mt-10 grid gap-8">
              {STEPS.map(({ title, text }, i) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr]">
                  <span className="mk-h3 text-(--gold)" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="mk-h3 block">{title}</span>
                    <span className="text-(--soft)">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div id="pricing" className="mk-anchor">
            <h2 className="mk-h2">Pricing</h2>
            <p className="mk-h3 mt-10">A setup fee, then a monthly fee.</p>
            <p className="mt-2 mb-8 text-(--soft)">
              Tell us what you need and we’ll send you the exact amount.
            </p>
            <GetStarted />
          </div>
        </div>
      </section>

      <section className="mk-wrap grid gap-10 py-20 md:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <h2 className="mk-h2">Questions</h2>
        <div className="mk-faq">
          {FAQ.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p className="pb-6 text-(--soft)">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mk-close">
        <div className="mk-wrap flex flex-col items-start gap-8 py-20 md:flex-row md:items-center md:justify-between md:py-24">
          <h2 className="mk-h2">Ready to go online?</h2>
          <GetStarted gold />
        </div>
      </section>
    </>
  );
}
