import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { storeHref, storePaths } from '@/components/storefront/links';
import { StoreImage } from '@/components/storefront/store-image';
import type { ResolvedSection } from '@/features/storefront/home';
import type { StoreContext } from '../../contract';
import { ProductGrid } from '../product-card';
import { SectionHeading } from '../section-heading';
import { HeroSlider } from './hero-slider';

type SectionProps<T extends ResolvedSection['type']> = {
  section: Extract<ResolvedSection, { type: T }>;
  store: StoreContext;
  /** True for the first section, whose image is likely the LCP element. */
  isFirst: boolean;
};

const primaryButton =
  'bg-store-accent text-store-on-accent rounded-store inline-flex items-center gap-2 px-7 py-3.5 text-xs font-medium tracking-[0.16em] uppercase transition-opacity hover:opacity-90';

function Hero({ section, store, isFirst }: SectionProps<'hero'>) {
  const { eyebrow, subheading, ctaLabel, ctaHref } = section.props;
  return (
    <section aria-label="Featured collections">
      <HeroSlider>
        {section.banners.map((banner, i) => (
          <div
            key={banner.id}
            className="relative isolate flex min-h-[78svh] items-end md:min-h-[82vh] md:items-center"
          >
            <StoreImage
              image={banner.image}
              alt=""
              fill
              sizes="100vw"
              priority={isFirst && i === 0}
              // Hero art leaves the left side free for the heading, so the
              // subject is on the right: keep it in frame on tall screens.
              className="-z-10 object-[75%_center] md:object-center"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/55 md:via-black/20" />
            <div className="mx-auto w-full max-w-7xl px-5 pb-20 text-white md:px-10 md:pb-0">
              <div className="max-w-xl">
                {eyebrow && (
                  <p className="mb-4 text-xs tracking-[0.28em] uppercase opacity-90">
                    {eyebrow}
                  </p>
                )}
                {banner.heading &&
                  (i === 0 ? (
                    <h1 className="font-store-heading text-5xl leading-[1.05] md:text-7xl">
                      {banner.heading}
                    </h1>
                  ) : (
                    <p className="font-store-heading text-5xl leading-[1.05] md:text-7xl">
                      {banner.heading}
                    </p>
                  ))}
                {subheading && i === 0 && (
                  <p className="mt-5 max-w-md text-lg opacity-90">
                    {subheading}
                  </p>
                )}
                <Link
                  href={storeHref(store.basePath, banner.link ?? ctaHref)}
                  className={`${primaryButton} mt-8`}
                >
                  {ctaLabel}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </HeroSlider>
    </section>
  );
}

function CategoryTiles({ section, store }: SectionProps<'categoryTiles'>) {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <SectionHeading title={section.props.title} />
      <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {section.categories.map((category) => (
          <li key={category.id}>
            <Link
              href={storeHref(
                store.basePath,
                storePaths.category(category.slug),
              )}
              className="group relative isolate block aspect-square overflow-hidden rounded-store"
            >
              {category.image && (
                <StoreImage
                  image={category.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="-z-10 transition-transform duration-700 ease-out group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white md:p-6">
                <span className="font-store-heading text-2xl md:text-3xl">
                  {category.name}
                </span>
                <ArrowRight
                  className="size-5 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedProducts({
  section,
  store,
  isFirst,
}: SectionProps<'featuredProducts'>) {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <SectionHeading
        title={section.props.title}
        subtitle={section.props.subtitle}
      />
      <ProductGrid
        products={section.products}
        basePath={store.basePath}
        priorityCount={isFirst ? 2 : 0}
        className="mt-12"
      />
    </section>
  );
}

function PromoBanner({ section, store }: SectionProps<'promoBanner'>) {
  const { eyebrow, heading, body, ctaLabel, ctaHref } = section.props;
  return (
    <section className="bg-store-subtle">
      <div className="mx-auto grid max-w-7xl items-center md:grid-cols-2">
        {section.banner && (
          <div className="relative aspect-[4/3] md:aspect-auto md:h-full md:min-h-[520px]">
            <StoreImage
              image={section.banner.image}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
        )}
        <div className="px-6 py-14 md:px-16 md:py-20">
          {eyebrow && (
            <p className="mb-3 text-xs tracking-[0.22em] text-store-primary uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="font-store-heading text-4xl leading-tight md:text-5xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-5 max-w-md text-lg text-store-muted">{body}</p>
          )}
          {ctaLabel && ctaHref && (
            <Link
              href={storeHref(store.basePath, ctaHref)}
              className="mt-8 inline-flex items-center gap-2 rounded-store bg-store-primary px-7 py-3.5 text-xs font-medium tracking-[0.16em] text-store-on-primary uppercase transition-opacity hover:opacity-90"
            >
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function BrandStory({ section }: SectionProps<'brandStory'>) {
  const { eyebrow, heading, body } = section.props;
  return (
    <section className="mx-auto max-w-3xl px-6 text-center">
      <SectionHeading eyebrow={eyebrow} title={heading} />
      <p className="mt-8 text-lg leading-relaxed text-store-muted md:text-xl">
        {body}
      </p>
    </section>
  );
}

/** Renders one resolved section with the silk template's component for it. */
export function SilkSection(props: {
  section: ResolvedSection;
  store: StoreContext;
  isFirst: boolean;
}) {
  const { section, ...rest } = props;
  switch (section.type) {
    case 'hero':
      return <Hero section={section} {...rest} />;
    case 'categoryTiles':
      return <CategoryTiles section={section} {...rest} />;
    case 'featuredProducts':
      return <FeaturedProducts section={section} {...rest} />;
    case 'promoBanner':
      return <PromoBanner section={section} {...rest} />;
    case 'brandStory':
      return <BrandStory section={section} {...rest} />;
  }
}
