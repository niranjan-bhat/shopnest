import {
  Check,
  Eye,
  Layers,
  MessageCircle,
  Paintbrush,
  ShoppingBag,
} from 'lucide-react';
import Image from 'next/image';
import boutiqueShot from '@/assets/marketing/boutique-demo.jpg';
import laptopShot from '@/assets/marketing/laptop.jpg';
import productShot from '@/assets/marketing/product.jpg';
import sareeShot from '@/assets/marketing/saree-demo.jpg';
import { DEMOS, demoUrl, salesLink } from '@/features/marketing/site';

const SHOTS = { 'saree-demo': sareeShot, 'boutique-demo': boutiqueShot };

const TICKS = [
  'No coding needed',
  'We set it up for you',
  'Built for clothing shops',
];

const FEATURES = [
  {
    icon: Paintbrush,
    title: 'Your brand',
    text: 'Your logo, colours, fonts and banners, at yourshop.zarify.in.',
  },
  {
    icon: ShoppingBag,
    title: 'Your products',
    text: 'Photos, prices, sizes and colours. Add them from your phone.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp orders',
    text: 'Shoppers send you the full order. A copy stays in your dashboard.',
  },
  {
    icon: Layers,
    title: 'Stock',
    text: 'Shoppers see what is left, and sold out when it is gone.',
  },
];

const STEPS = [
  {
    title: 'Message us',
    text: 'Tell us about your shop and send your logo and a few photos.',
  },
  {
    title: 'We set up your store',
    text: 'You get a sign-in. Add your products and check how it looks.',
  },
  {
    title: 'Share your link',
    text: 'Put it in your bio. Orders arrive on your WhatsApp.',
  },
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

function WhatsAppButton() {
  return (
    <a href={salesLink} className="mk-btn">
      <MessageCircle aria-hidden className="size-5" />
      Chat on WhatsApp
    </a>
  );
}

/** The platform's home page. */
export function Landing() {
  return (
    <>
      <section className="mk-hero">
        <div className="mk-wrap grid items-center gap-12 pt-10 lg:grid-cols-[1fr_1.25fr] lg:pt-14 lg:pb-24">
          <div>
            <p className="mk-for">For boutiques and fashion brands</p>
            <h1 className="mk-display mt-4 text-[clamp(2.7rem,4.2vw,3.75rem)]">
              Launch your <em className="block">fashion store online</em>
            </h1>
            <p className="mt-5 max-w-[33rem] text-lg text-(--soft) md:text-xl">
              A beautiful store for your sarees and ethnic wear, with{' '}
              <strong className="text-(--ink)">orders on WhatsApp</strong>.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <WhatsAppButton />
              <a href="#demos" className="mk-btn mk-btn-quiet">
                <Eye aria-hidden className="size-5" />
                View sample stores
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {TICKS.map((tick) => (
                <li key={tick} className="flex items-center gap-2">
                  <Check aria-hidden className="size-4 text-(--maroon)" />
                  {tick}
                </li>
              ))}
            </ul>
          </div>
          <div className="mk-devices">
            <div className="mk-laptop">
              <div className="mk-screen">
                <Image
                  src={laptopShot}
                  alt="The Tara Weaves demo store on a laptop"
                  sizes="(min-width: 64rem) 36rem, 90vw"
                />
              </div>
            </div>
            <div className="mk-phone">
              <Image
                src={productShot}
                alt="A saree’s page in the demo store, on a phone"
                sizes="16rem"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
        <div className="mk-border" aria-hidden />
      </section>

      <section className="mk-wrap py-12 md:py-16">
        <h2 className="sr-only">What your shop gets</h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="mk-card">
              <span className="mk-icon">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="mk-display text-xl">{title}</h3>
                <p className="mt-1.5 leading-snug text-(--soft)">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="demos" className="scroll-mt-4 bg-white py-16 md:py-24">
        <div className="mk-wrap">
          <h2 className="mk-display mk-h2">Try a demo store</h2>
          <p className="mt-3 max-w-[36rem] text-(--soft)">
            These shops are made up, but the stores work. Open one on your phone
            and look around.
          </p>
          <ul className="mt-10 grid gap-12 sm:grid-cols-2">
            {DEMOS.map((demo) => (
              <li key={demo.slug}>
                <a
                  href={demoUrl(demo.slug)}
                  className="mx-auto block max-w-[17rem]"
                >
                  <span className="mk-phone block">
                    <Image src={SHOTS[demo.slug]} alt="" sizes="17rem" />
                  </span>
                  <span className="mt-5 block text-xl font-bold underline decoration-(--maroon) decoration-2 underline-offset-4">
                    {demo.name}
                  </span>
                  <span className="block text-(--soft)">
                    {demo.kind} (demo)
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mk-wrap grid gap-14 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <div>
          <h2 className="mk-display mk-h2">How it works</h2>
          <ol className="mt-7 grid gap-6">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="grid grid-cols-[3rem_1fr]">
                <span
                  className="mk-display text-4xl text-(--maroon)"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-xl font-bold">{title}</span>
                  <span className="text-(--soft)">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div id="pricing" className="scroll-mt-4">
          <h2 className="mk-display mk-h2">Pricing</h2>
          <p className="mt-7 text-xl">
            One setup fee, then a monthly fee, depending on what your shop
            needs.
          </p>
          <p className="mt-3 text-(--soft)">
            Tell us about your shop and we’ll send you the exact amount.
          </p>
          <div className="mt-6">
            <WhatsAppButton />
          </div>
        </div>
      </section>

      <section className="mk-wrap pb-16 md:pb-24">
        <h2 className="mk-display mk-h2">Common questions</h2>
        <div className="mk-faq mt-6 max-w-[46rem]">
          {FAQ.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p className="pb-5 text-(--soft)">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mk-close">
        <div className="mk-wrap flex flex-col items-start gap-7 py-16 md:py-20">
          <h2 className="mk-display mk-h2 max-w-[18ch]">
            Let’s put your shop online
          </h2>
          <WhatsAppButton />
        </div>
      </section>
    </>
  );
}
