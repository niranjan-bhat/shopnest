'use client';

import { cn } from 'cn';
import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SIZE_ORDER } from '@/features/catalog/attributes';
import type { ProductFormValues } from '@/features/catalog/product-schema';
import {
  buildVariants,
  variantLabel,
  type OptionLists,
  type VariantDraft,
} from '@/features/catalog/variant-builder';

/**
 * Sizes and colours, and the variant table they produce. Changing either
 * list rebuilds the table, keeping what was typed for rows that stay (and
 * the saved variants' ids, so carts holding them keep working).
 */
export function ProductOptions({ saved }: { saved: VariantDraft[] }) {
  const {
    control,
    getValues,
    setValue,
    formState: { isSubmitted },
  } = useFormContext<ProductFormValues>();
  const variants = useFieldArray({ control, name: 'variants', keyName: 'key' });
  const sizes = useWatch({ control, name: 'sizes' });
  const colours = useWatch({ control, name: 'colours' });

  const apply = (next: OptionLists) => {
    const dirty = { shouldDirty: true, shouldValidate: isSubmitted };
    setValue('sizes', next.sizes, dirty);
    setValue('colours', next.colours, dirty);
    variants.replace(buildVariants(next, getValues('variants'), saved));
  };

  const toggleSize = (size: string) =>
    apply({
      sizes: sizes.includes(size)
        ? sizes.filter((s) => s !== size)
        : [...sizes, size],
      colours,
    });

  const customSizes = sizes.filter((s) => !SIZE_ORDER.includes(s));

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h3 className="text-sm font-medium" id="sizes-label">
          Sizes
        </h3>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="sizes-label"
        >
          {[...SIZE_ORDER, ...customSizes].map((size) => {
            const on = sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSize(size)}
                className={cn(
                  'h-8 min-w-10 rounded-lg border px-3 text-sm font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                {size}
              </button>
            );
          })}
          <AddValue
            label="Add a size"
            placeholder="e.g. 38"
            existing={sizes}
            onAdd={(size) => apply({ sizes: [...sizes, size], colours })}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Leave empty for one-size items like sarees.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-medium" id="colours-label">
          Colours
        </h3>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-labelledby="colours-label"
        >
          {colours.map((colour) => (
            <span
              key={colour}
              className="inline-flex h-8 items-center gap-1 rounded-lg border bg-muted pr-1 pl-3 text-sm"
            >
              {colour}
              <button
                type="button"
                className="rounded p-1 hover:bg-background"
                aria-label={`Remove ${colour}`}
                onClick={() =>
                  apply({ sizes, colours: colours.filter((c) => c !== colour) })
                }
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          <AddValue
            label="Add a colour"
            placeholder="e.g. Rust"
            existing={colours}
            onAdd={(colour) => apply({ sizes, colours: [...colours, colour] })}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Only if shoppers pick a colour on this product. Otherwise use the
          Colour detail above.
        </p>
      </div>

      <VariantTable fields={variants.fields} />
    </div>
  );
}

/** A small input with an Add button (Enter adds too). */
function AddValue({
  label,
  placeholder,
  existing,
  onAdd,
}: {
  label: string;
  placeholder: string;
  existing: string[];
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    if (clean.length > 40) {
      setError('Keep it under 40 characters');
      return;
    }
    if (existing.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      setError('Already added');
      return;
    }
    onAdd(clean);
    setValue('');
    setError('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex gap-1">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={Boolean(error)}
          className="h-8 w-32"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          onClick={add}
        >
          <Plus aria-hidden />
        </Button>
      </span>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

function VariantTable({
  fields,
}: {
  fields: (VariantDraft & { key: string })[];
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const priceMode = useWatch({ control, name: 'priceMode' });
  const productPrice = useWatch({ control, name: 'price' });
  const fixed = priceMode === 'fixed';
  const tableError = errors.variants?.root?.message ?? errors.variants?.message;

  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-sm font-medium">
          {fields.length === 1 ? 'Stock' : `Variants (${fields.length})`}
        </h3>
        <p className="text-sm text-muted-foreground">
          {fixed
            ? 'Leave a price empty to use the product price.'
            : 'Prices are confirmed on WhatsApp for this product.'}
        </p>
      </div>
      {tableError && (
        <p role="alert" className="text-sm text-destructive">
          {tableError}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border">
        <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Variant</span>
          <span>{fixed ? 'Price (₹)' : ''}</span>
          <span>Stock</span>
          <span>SKU (optional)</span>
          <span>Track stock</span>
        </div>
        <ul className="divide-y" aria-label="Variants">
          {fields.map((field, i) => {
            const label = variantLabel(field.options);
            const rowErrors = errors.variants?.[i];
            return (
              <li
                key={field.key}
                className="grid grid-cols-2 gap-3 px-3 py-3 md:grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] md:items-start"
                data-testid="variant-row"
              >
                <span className="col-span-2 self-center font-medium md:col-span-1">
                  {label}
                </span>
                {fixed ? (
                  <div>
                    <Input
                      inputMode="decimal"
                      placeholder={productPrice || 'Price'}
                      aria-label={`Price for ${label}`}
                      aria-invalid={Boolean(rowErrors?.price)}
                      {...register(`variants.${i}.price`)}
                    />
                    <FieldError errors={[rowErrors?.price]} className="mt-1" />
                  </div>
                ) : (
                  <span className="hidden md:block" />
                )}
                <div>
                  <Input
                    inputMode="numeric"
                    aria-label={`Stock for ${label}`}
                    aria-invalid={Boolean(rowErrors?.stock)}
                    {...register(`variants.${i}.stock`)}
                  />
                  <input
                    type="hidden"
                    {...register(`variants.${i}.stockWas`)}
                  />
                  <FieldError errors={[rowErrors?.stock]} className="mt-1" />
                </div>
                <div>
                  <Input
                    aria-label={`SKU for ${label}`}
                    aria-invalid={Boolean(rowErrors?.sku)}
                    {...register(`variants.${i}.sku`)}
                  />
                  <FieldError errors={[rowErrors?.sku]} className="mt-1" />
                </div>
                <label className="flex h-8 items-center gap-2 text-sm md:justify-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Track stock for ${label}`}
                    {...register(`variants.${i}.trackInventory`)}
                  />
                  <span className="md:sr-only">Track stock</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
