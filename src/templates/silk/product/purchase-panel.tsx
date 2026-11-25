'use client';

import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { Price } from '@/components/storefront/price';
import { QuantityStepper } from '@/components/storefront/quantity-stepper';
import { useStore } from '@/components/storefront/store-provider';
import { formatOptions, MAX_QTY_PER_LINE } from '@/features/cart/cart';
import { useCartDrawer, useCartStore } from '@/features/cart/store';
import { LOW_STOCK_THRESHOLD } from '@/features/catalog/mappers';
import type { ProductDetail } from '@/features/catalog/types';
import {
  canBuy,
  findVariant,
  isValueAvailable,
  optionValues,
} from '@/features/catalog/variants';
import { waLink } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { useProductSelection } from './selection';

const OPTION_LABELS: Record<string, string> = {
  size: 'Size',
  colour: 'Colour',
};
const optionLabel = (name: string) =>
  OPTION_LABELS[name] ?? name.replace(/^\w/, (c) => c.toUpperCase());

export function PurchasePanel({ product }: { product: ProductDetail }) {
  const store = useStore();
  const add = useCartStore((s) => s.add);
  const openCart = useCartDrawer((s) => s.setOpen);
  const { selection, select: choose, images } = useProductSelection();
  const [qty, setQty] = useState(1);
  const [showMissing, setShowMissing] = useState(false);
  const [added, setAdded] = useState(false);

  const variant = findVariant(product.variants, product.optionNames, selection);
  const missing = product.optionNames.filter((n) => selection[n] === undefined);
  const prices = new Set(product.variants.map((v) => v.pricePaise));
  const maxQty = Math.min(
    MAX_QTY_PER_LINE,
    variant?.trackInventory ? variant.stock : MAX_QTY_PER_LINE,
  );
  const soldOut = !product.inStock || !canBuy(product.variants, selection);

  const select = (name: string, value: string) => {
    choose(name, value);
    setQty(1);
    setAdded(false);
  };

  const addToBag = () => {
    if (!variant) {
      setShowMissing(true);
      return;
    }
    add(
      store.id,
      {
        variantId: variant.id,
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        optionsLabel: formatOptions(variant.options),
        unitPricePaise: variant.pricePaise,
        imageKey: images[0]?.key ?? null,
        maxQty: variant.trackInventory ? variant.stock : null,
      },
      qty,
    );
    setAdded(true);
    openCart(true);
  };

  const askText = `Hello ${store.name}, I'm interested in "${product.name}"${
    variant && Object.keys(variant.options).length
      ? ` (${formatOptions(variant.options)})`
      : ''
  }. Is it available?`;

  return (
    <div className="space-y-7">
      <div>
        <Price
          pricePaise={variant ? variant.pricePaise : product.pricePaise}
          compareAtPaise={product.compareAtPaise}
          from={!variant && prices.size > 1}
          className="text-2xl"
        />
        {product.pricePaise === null && (
          <p className="mt-2 text-sm text-store-muted">
            Made to order. The store confirms the price with you on WhatsApp.
          </p>
        )}
        <div aria-live="polite" className="mt-2 text-sm empty:hidden">
          {soldOut ? (
            <p className="text-store-muted">
              Sold out{product.inStock ? ' in this option' : ''}.
            </p>
          ) : variant?.trackInventory &&
            variant.stock <= LOW_STOCK_THRESHOLD ? (
            <p className="text-store-primary">Only {variant.stock} left</p>
          ) : null}
        </div>
      </div>

      {product.optionNames.map((name) => {
        const values = optionValues(product.variants, name);
        // Nothing to choose: a single colour is only named.
        const onlyNamed = name === 'colour' && values.length === 1;
        const isMissing = showMissing && missing.includes(name);
        return (
          <fieldset key={name}>
            <legend className="mb-3 text-sm">
              <span className="font-medium">{optionLabel(name)}</span>
              {selection[name] && (
                <span className="text-store-muted">: {selection[name]}</span>
              )}
            </legend>
            {!onlyNamed && (
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const available = isValueAvailable(
                    product.variants,
                    selection,
                    name,
                    value,
                  );
                  const selected = selection[name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => select(name, value)}
                      // A sold-out colour can still be looked at.
                      disabled={!available && name !== 'colour'}
                      aria-pressed={selected}
                      className={cn(
                        'min-w-12 rounded-store border px-4 py-2.5 text-sm transition-colors',
                        selected
                          ? 'border-store-text bg-store-text text-store-bg'
                          : 'border-store-border hover:border-store-text',
                        !available && 'line-through opacity-60',
                        !available &&
                          !selected &&
                          'text-store-muted hover:border-store-border',
                        !available && name !== 'colour' && 'cursor-not-allowed',
                      )}
                    >
                      {value}
                      {!available && (
                        <span className="sr-only"> (sold out)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {isMissing && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Please choose a {optionLabel(name).toLowerCase()}.
              </p>
            )}
          </fieldset>
        );
      })}

      <div className="flex gap-3">
        <QuantityStepper
          value={qty}
          max={Math.max(1, maxQty)}
          onChange={setQty}
          label="Quantity"
        />
        <button
          type="button"
          onClick={addToBag}
          disabled={soldOut}
          className="flex flex-1 items-center justify-center gap-2 rounded-store bg-store-primary text-sm font-medium tracking-[0.14em] text-store-on-primary uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added && <Check className="size-4" aria-hidden />}
          {soldOut ? 'Sold out' : added ? 'Added to bag' : 'Add to bag'}
        </button>
      </div>

      <a
        href={waLink(store.whatsappNumber, askText)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-store border border-store-border py-3 text-sm transition-colors hover:bg-store-subtle"
      >
        <MessageCircle className="size-4" aria-hidden />
        Ask about this on WhatsApp
      </a>
    </div>
  );
}
