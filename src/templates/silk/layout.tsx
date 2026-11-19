import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { CartButton } from '@/components/storefront/cart-button';
import { storeHref, storePaths } from '@/components/storefront/links';
import { StoreImage } from '@/components/storefront/store-image';
import type { StoreContext, StoreLayoutProps } from '../contract';
import { MobileNav } from './mobile-nav';

function navItems(store: StoreContext) {
  return store.categories.map((c) => ({
    href: storeHref(store.basePath, storePaths.category(c.slug)),
    label: c.name,
  }));
}

function Wordmark({ store }: { store: StoreContext }) {
  const home = storeHref(store.basePath, storePaths.home);
  return (
    <Link
      href={home}
      className="block text-center"
      aria-label={`${store.name} home`}
    >
      {store.branding.logoKey ? (
        <StoreImage
          image={{
            key: store.branding.logoKey,
            alt: store.name,
            width: 240,
            height: 80,
          }}
          sizes="240px"
          priority
          className="mx-auto h-10 w-auto object-contain"
        />
      ) : (
        <span className="font-store-heading text-[1.65rem] leading-none tracking-[0.06em] md:text-4xl">
          {store.name}
        </span>
      )}
    </Link>
  );
}

function Header({ store }: { store: StoreContext }) {
  const items = navItems(store);
  return (
    <header className="sticky top-0 z-40 border-b border-store-border bg-store-bg/95 backdrop-blur supports-[backdrop-filter]:bg-store-bg/85">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3 md:px-8 lg:py-5">
        <div className="flex">
          <MobileNav
            storeName={store.name}
            basePath={store.basePath}
            items={items}
          />
        </div>
        <Wordmark store={store} />
        <div className="flex justify-end">
          <CartButton className="-mr-2" />
        </div>
      </div>
      <nav aria-label="Categories" className="hidden pb-4 lg:block">
        <ul className="flex justify-center gap-10 text-[0.8rem] tracking-[0.16em] uppercase">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:text-store-primary hover:after:scale-x-100"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Footer({ store }: { store: StoreContext }) {
  const items = navItems(store);
  return (
    <footer className="mt-24 bg-store-primary text-store-on-primary">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <p className="font-store-heading text-3xl">{store.name}</p>
          {store.branding.tagline && (
            <p className="mt-3 max-w-sm opacity-80">{store.branding.tagline}</p>
          )}
        </div>
        <nav aria-label="Shop">
          <h2 className="text-xs tracking-[0.18em] uppercase opacity-70">
            Shop
          </h2>
          <ul className="mt-4 space-y-2.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-xs tracking-[0.18em] uppercase opacity-70">
            How to order
          </h2>
          <p className="mt-4 flex gap-2.5 opacity-90">
            <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Add pieces to your bag and check out on WhatsApp. We confirm
            availability, delivery and payment with you there.
          </p>
        </div>
      </div>
      <div className="border-t border-store-on-primary/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs opacity-70 md:px-8">
          © {store.name} · Powered by ShopNest
        </p>
      </div>
    </footer>
  );
}

export function SilkLayout({ store, children }: StoreLayoutProps) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-store-primary px-4 py-2 text-store-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {store.announcement && (
        <p className="bg-store-primary px-4 py-2 text-center text-[0.72rem] tracking-[0.14em] text-store-on-primary uppercase">
          {store.announcement}
        </p>
      )}
      <Header store={store} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer store={store} />
    </>
  );
}
