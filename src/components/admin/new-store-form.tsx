'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createStore } from '@/features/admin/actions';
import type { StoreOptions } from '@/features/admin/queries';
import {
  BUSINESS_TYPES,
  newStoreSchema,
  STORE_SLUG_MAX,
  type NewStoreField,
  type NewStoreInput,
  type NewStoreValues,
} from '@/features/admin/store-schema';
import { formatINR } from '@/lib/money';
import { slugify } from '@/lib/slug';
import { useHydrated } from '@/lib/use-hydrated';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive';

/** The store's address, suggested from its name. */
const suggestSlug = (name: string) =>
  slugify(name).slice(0, STORE_SLUG_MAX).replace(/-+$/, '');

function templatesOf(options: StoreOptions, planId: string | undefined) {
  const keys = options.plans.find((p) => p.id === planId)?.templateKeys;
  return keys
    ? options.templates.filter((t) => keys.includes(t.key))
    : options.templates;
}

export function NewStoreForm({
  options,
  rootDomain,
}: {
  options: StoreOptions;
  rootDomain: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getFieldState,
    getValues,
    control,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<NewStoreInput, unknown, NewStoreValues>({
    resolver: zodResolver(newStoreSchema),
    defaultValues: {
      name: '',
      slug: '',
      businessType: 'saree',
      whatsappNumber: '',
      ownerEmail: '',
      templateKey: templatesOf(options, options.plans[0]?.id)[0]?.key ?? '',
      planId: options.plans[0]?.id ?? '',
    },
  });

  const onSubmit = (values: NewStoreValues) =>
    startTransition(async () => {
      try {
        const result = await createStore(values);
        if (result.ok) {
          toast.success(`${values.name} created`);
          // Visited pages stay mounted: leave an empty form behind.
          reset();
          router.push(`/admin/tenants/${result.storeId}`);
          return;
        }
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as NewStoreField, { message }, { shouldFocus: true });
        }
        toast.error('Check the highlighted fields.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  const field = (
    name: NewStoreField,
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void,
  ) => ({
    id: `store-${name}`,
    'aria-invalid': Boolean(errors[name]),
    ...register(name, { onChange }),
  });

  // Only the plan's templates are offered.
  const planId = useWatch({ control, name: 'planId' });
  const templates = templatesOf(options, planId);
  const pickTemplate = (event: ChangeEvent<HTMLSelectElement>) => {
    const offered = templatesOf(options, event.target.value);
    if (!offered.some((t) => t.key === getValues('templateKey'))) {
      setValue('templateKey', offered[0]?.key ?? '');
    }
  };

  const nameField = field('name');

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-hydrated={hydrated || undefined}
    >
      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="store-name">Store name</FieldLabel>
              <Input
                autoComplete="off"
                {...nameField}
                onChange={(event) => {
                  void nameField.onChange(event);
                  // Follow the name until the address is edited by hand.
                  if (!dirtyFields.slug && !getFieldState('slug').isDirty) {
                    setValue('slug', suggestSlug(event.target.value));
                  }
                }}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.slug)}>
              <FieldLabel htmlFor="store-slug">Address</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  {...field('slug')}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  .{rootDomain}
                </span>
              </div>
              <FieldDescription>
                Shoppers open the store here. Choose carefully: it cannot be
                changed from this screen.
              </FieldDescription>
              <FieldError errors={[errors.slug]} />
            </Field>
            <Field data-invalid={Boolean(errors.businessType)}>
              <FieldLabel htmlFor="store-businessType">Business</FieldLabel>
              <select className={selectClass} {...field('businessType')}>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <FieldError errors={[errors.businessType]} />
            </Field>
            <Field data-invalid={Boolean(errors.whatsappNumber)}>
              <FieldLabel htmlFor="store-whatsappNumber">
                WhatsApp number for orders
              </FieldLabel>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="98765 43210"
                {...field('whatsappNumber')}
              />
              <FieldError errors={[errors.whatsappNumber]} />
            </Field>
            <Field data-invalid={Boolean(errors.ownerEmail)}>
              <FieldLabel htmlFor="store-ownerEmail">
                Owner&apos;s email
              </FieldLabel>
              <Input type="email" autoComplete="off" {...field('ownerEmail')} />
              <FieldDescription>
                Whoever can read this inbox can manage the store, so check the
                spelling. Nothing is emailed now.
              </FieldDescription>
              <FieldError errors={[errors.ownerEmail]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.planId)}>
                <FieldLabel htmlFor="store-planId">Plan</FieldLabel>
                <select
                  className={selectClass}
                  {...field('planId', pickTemplate)}
                >
                  {options.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({formatINR(plan.monthlyFeePaise)}/month)
                    </option>
                  ))}
                </select>
                <FieldError errors={[errors.planId]} />
              </Field>
              <Field data-invalid={Boolean(errors.templateKey)}>
                <FieldLabel htmlFor="store-templateKey">Template</FieldLabel>
                <select className={selectClass} {...field('templateKey')}>
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <FieldError errors={[errors.templateKey]} />
              </Field>
            </div>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create store'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
