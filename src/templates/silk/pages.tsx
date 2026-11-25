import Link from 'next/link';
import { CartView } from '@/components/storefront/cart-view';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { storeHref, storePaths } from '@/components/storefront/links';
import type {
  CategoryPageProps,
  HomePageProps,
  ProductPageProps,
  StorePageProps,
} from '../contract';
import { CatalogBrowser } from './category/catalog-browser';
import { ProductGallery } from './product/gallery';
import { ProductSelectionProvider } from './product/selection';
import { PurchasePanel } from './product/purchase-panel';
import { ProductGrid } from './product-card';
import { SectionHeading } from './section-heading';
import { SilkSection } from './sections';

function Breadcrumbs({
  basePath,
  trail,
}: {
  basePath: string;
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-xs tracking-wide text-store-muted"
    >
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            href={storeHref(basePath, storePaths.home)}
            className="hover:text-store-text"
          >
            Home
          </Link>
        </li>
        {trail.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-store-text">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-store-text">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SilkHomePage({ store, sections }: HomePageProps) {
  const startsWithHero = sections[0]?.type === 'hero';
  return (
    <div className="space-y-24 md:space-y-32">
      {!startsWithHero && <h1 className="sr-only">{store.name}</h1>}
      {sections.map((section, i) => (
        <SilkSection
          key={`${section.type}-${i}`}
          section={section}
          store={store}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
}

export function SilkCategoryPage({
  store,
  category,
  products,
  totalInCategory,
  facets,
  filters,
  activeFilters,
}: CategoryPageProps) {
  const categoryHref = storeHref(
    store.basePath,
    storePaths.category(category.slug),
  );
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
      <Breadcrumbs
        basePath={store.basePath}
        trail={[{ label: category.name }]}
      />
      <SectionHeading
        as="h1"
        title={category.name}
        subtitle={`${totalInCategory} ${totalInCategory === 1 ? 'piece' : 'pieces'}`}
        className="mt-6 mb-12"
      />
      <CatalogBrowser
        facets={facets}
        filters={filters}
        activeFilters={activeFilters}
        resultCount={products.length}
        clearHref={categoryHref}
      >
        {products.length > 0 ? (
          <ProductGrid
            products={products}
            basePath={store.basePath}
            priorityCount={2}
            className="sm:grid-cols-2 lg:grid-cols-3"
          />
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-store-muted">
              Nothing matches these filters.
            </p>
            <Link
              href={categoryHref}
              className="mt-3 inline-block text-store-primary underline underline-offset-4"
            >
              Clear filters
            </Link>
          </div>
        )}
      </CatalogBrowser>
    </div>
  );
}

export function SilkProductPage({ store, product, related }: ProductPageProps) {
  const category = product.categories[0];
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-8">
      <Breadcrumbs
        basePath={store.basePath}
        trail={[
          ...(category
            ? [
                {
                  label: category.name,
                  href: storeHref(
                    store.basePath,
                    storePaths.category(category.slug),
                  ),
                },
              ]
            : []),
          { label: product.name },
        ]}
      />
      <ProductSelectionProvider product={product}>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <ProductGallery productName={product.name} />
          <div className="lg:sticky lg:top-36 lg:h-fit">
            <h1 className="font-store-heading text-4xl leading-tight md:text-5xl">
              {product.name}
            </h1>
            <div className="mt-5">
              <PurchasePanel product={product} />
            </div>
            {product.description && (
              <div className="mt-10 border-t border-store-border pt-8">
                <h2 className="text-xs tracking-[0.18em] uppercase">
                  Description
                </h2>
                <p className="mt-3 leading-relaxed text-store-muted">
                  {product.description}
                </p>
              </div>
            )}
            {product.attributes.length > 0 && (
              <div className="mt-8 border-t border-store-border pt-8">
                <h2 className="text-xs tracking-[0.18em] uppercase">Details</h2>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
                  {product.attributes.map((attribute) => (
                    <div key={attribute.label} className="contents">
                      <dt className="text-store-muted">{attribute.label}</dt>
                      <dd>{attribute.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </ProductSelectionProvider>
      {related.length > 0 && (
        <section className="mt-24 md:mt-32">
          <SectionHeading title="You may also like" />
          <ProductGrid
            products={related}
            basePath={store.basePath}
            className="mt-12"
          />
        </section>
      )}
    </div>
  );
}

export function SilkCartPage(props: StorePageProps) {
  void props;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
      <SectionHeading as="h1" title="Your bag" className="mb-12" />
      <CartView />
    </div>
  );
}

export function SilkCheckoutPage(props: StorePageProps) {
  void props;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
      <SectionHeading
        as="h1"
        title="Checkout"
        subtitle="Share your delivery details and we'll send your order on WhatsApp."
        className="mb-12"
      />
      <CheckoutForm />
    </div>
  );
}
