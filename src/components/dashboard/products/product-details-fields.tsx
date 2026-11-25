'use client';

import { Plus, X } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CLOTHING_ATTRIBUTES } from '@/features/catalog/attributes';
import type { ProductFormValues } from '@/features/catalog/product-schema';

/** The clothing preset (fabric, zari, fit…) plus the merchant's own. */
export function ProductDetailsFields() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const extra = useFieldArray({ control, name: 'extraDetails' });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {CLOTHING_ATTRIBUTES.map((attribute) => {
          const error = errors.attributes?.[attribute.key];
          return (
            <Field key={attribute.key} data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={`attr-${attribute.key}`}>
                {attribute.label}
              </FieldLabel>
              <Input
                id={`attr-${attribute.key}`}
                placeholder={`e.g. ${attribute.example}`}
                aria-invalid={Boolean(error)}
                {...register(`attributes.${attribute.key}`)}
              />
              <FieldError errors={[error]} />
            </Field>
          );
        })}
      </div>

      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-medium">More details</h3>
          <p className="text-sm text-muted-foreground">
            Anything else shoppers should know, like Work: Gota patti.
          </p>
        </div>
        {extra.fields.map((field, i) => {
          const labelError = errors.extraDetails?.[i]?.label;
          const valueError = errors.extraDetails?.[i]?.value;
          return (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_1.6fr_auto] items-start gap-2"
            >
              <div>
                <Input
                  placeholder="Detail, e.g. Work"
                  aria-label={`Detail ${i + 1} name`}
                  aria-invalid={Boolean(labelError)}
                  {...register(`extraDetails.${i}.label`)}
                />
                <FieldError errors={[labelError]} className="mt-1" />
              </div>
              <div>
                <Input
                  placeholder="Value, e.g. Gota patti"
                  aria-label={`Detail ${i + 1} value`}
                  aria-invalid={Boolean(valueError)}
                  {...register(`extraDetails.${i}.value`)}
                />
                <FieldError errors={[valueError]} className="mt-1" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove detail ${i + 1}`}
                onClick={() => extra.remove(i)}
              >
                <X aria-hidden />
              </Button>
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => extra.append({ label: '', value: '' })}
            disabled={extra.fields.length >= 20}
          >
            <Plus aria-hidden />
            Add a detail
          </Button>
        </div>
      </div>
    </div>
  );
}
