import Link from 'next/link';
import { storeHref, storePaths } from '@/components/storefront/links';
import { discountPercent, Price } from '@/components/storefront/price';
import { StoreImage } from '@/components/storefront/store-image';
import type { ProductCardData } from '@/features/catalog/types';
import { cn } from '@/lib/utils';

const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw';

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: 'accent' | 'muted';
}) {
  return (
    <span
      className={cn(
        'px-2.5 py-1 text-[0.68rem] font-medium tracking-[0.12em] uppercase',
        tone === 'accent'
          ? 'bg-store-accent text-store-on-accent'
          : 'bg-store-bg/90 text-store-text',
      )}
    >
      {children}
    </span>
  );
}

export function ProductCard({
  product,
  basePath,
  priority = false,
}: {
  product: ProductCardData;
  basePath: string;
  priority?: boolean;
}) {
  const onSale =
    product.pricePaise !== null &&
    !!product.compareAtPaise &&
    product.compareAtPaise > product.pricePaise;

  return (
    <article className="group relative">
      <div className="relative aspect-[3/4] overflow-hidden rounded-store bg-store-subtle">
        {product.image && (
          <StoreImage
            image={product.image}
            fill
            sizes={CARD_SIZES}
            priority={priority}
            className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        )}
        {product.hoverImage && (
          <StoreImage
            image={product.hoverImage}
            alt=""
            fill
            sizes={CARD_SIZES}
            className="opacity-0 transition-opacity duration-500 group-hover:opacity-100 max-md:hidden"
          />
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {!product.inStock ? (
            <Badge tone="muted">Sold out</Badge>
          ) : onSale ? (
            <Badge tone="accent">
              {`${discountPercent(product.pricePaise!, product.compareAtPaise!)}% off`}
            </Badge>
          ) : product.lowStock ? (
            <Badge tone="muted">Few left</Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3.5 space-y-1">
        <h3 className="font-store-heading text-lg leading-snug md:text-xl">
          <Link
            href={storeHref(basePath, storePaths.product(product.slug))}
            className="after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>
        <Price
          pricePaise={product.pricePaise}
          compareAtPaise={product.compareAtPaise}
          className="text-sm"
        />
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  basePath,
  priorityCount = 0,
  className,
}: {
  products: ProductCardData[];
  basePath: string;
  /** How many leading cards may be above the fold on mobile. */
  priorityCount?: number;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4',
        className,
      )}
    >
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            basePath={basePath}
            priority={i < priorityCount}
          />
        </li>
      ))}
    </ul>
  );
}
