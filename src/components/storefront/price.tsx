import { formatINR } from '@/lib/money';
import { cn } from '@/lib/utils';

type PriceProps = {
  /** Paise; null means price on request. */
  pricePaise: number | null;
  compareAtPaise?: number | null;
  /** Prefix "From" when variants have different prices. */
  from?: boolean;
  className?: string;
};

export function discountPercent(price: number, compareAt: number): number {
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function Price({
  pricePaise,
  compareAtPaise,
  from = false,
  className,
}: PriceProps) {
  if (pricePaise === null) {
    return (
      <span className={cn('text-store-muted italic', className)}>
        Price on request
      </span>
    );
  }
  const onSale = !!compareAtPaise && compareAtPaise > pricePaise;
  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}
    >
      <span className={cn(onSale && 'text-store-primary')}>
        {from && <span className="text-[0.85em] text-store-muted">From </span>}
        {formatINR(pricePaise)}
      </span>
      {onSale && (
        <>
          <s className="text-[0.85em] text-store-muted">
            <span className="sr-only">Was </span>
            {formatINR(compareAtPaise)}
          </s>
          <span className="text-[0.8em] font-medium text-store-primary">
            {discountPercent(pricePaise, compareAtPaise)}% off
          </span>
        </>
      )}
    </span>
  );
}
