'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, type ReactNode } from 'react';
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form';
import type { z } from 'zod';
import { StoreImage } from '@/components/storefront/store-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DashboardBanner } from '@/features/theme/banner-queries';
import type { Section, SectionType } from '@/features/theme/schema';
import { sectionPropsSchemas } from '@/features/theme/sections';

type FieldSpec = { name: string; label: string; help?: string } & (
  | { kind: 'text'; placeholder?: string }
  | { kind: 'textarea'; rows: number }
  | { kind: 'count'; options: number[]; unit: string }
  | { kind: 'source' }
  | { kind: 'banner' }
  | { kind: 'banners' }
);

const BUTTON_LINK_HELP =
  'A page of your store such as /c/sarees, or a full web address.';

const FIELDS: Record<SectionType, FieldSpec[]> = {
  hero: [
    {
      name: 'bannerIds',
      label: 'Banners',
      kind: 'banners',
      help: 'Each banner is one slide, with its own heading and link.',
    },
    {
      name: 'eyebrow',
      label: 'Small line above the heading',
      kind: 'text',
      placeholder: 'e.g. Wedding season 2026',
    },
    {
      name: 'subheading',
      label: 'Subheading',
      kind: 'text',
      help: 'Shown under the first slide’s heading.',
    },
    { name: 'ctaLabel', label: 'Button text', kind: 'text' },
    {
      name: 'ctaHref',
      label: 'Button link',
      kind: 'text',
      placeholder: '/',
      help: `Used when a banner has no link of its own. ${BUTTON_LINK_HELP}`,
    },
  ],
  categoryTiles: [
    { name: 'title', label: 'Title', kind: 'text' },
    {
      name: 'limit',
      label: 'How many',
      kind: 'count',
      options: [2, 3, 4, 6, 8, 12],
      unit: 'categories',
      help: 'Visible categories, in your category order.',
    },
  ],
  featuredProducts: [
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'subtitle', label: 'Subtitle', kind: 'text' },
    { name: 'source', label: 'Show', kind: 'source' },
    {
      name: 'limit',
      label: 'How many',
      kind: 'count',
      options: [4, 8, 12, 16, 24],
      unit: 'products',
    },
  ],
  promoBanner: [
    { name: 'bannerId', label: 'Banner', kind: 'banner' },
    { name: 'eyebrow', label: 'Small line above the heading', kind: 'text' },
    { name: 'heading', label: 'Heading', kind: 'text' },
    { name: 'body', label: 'Text', kind: 'textarea', rows: 3 },
    { name: 'ctaLabel', label: 'Button text', kind: 'text' },
    {
      name: 'ctaHref',
      label: 'Button link',
      kind: 'text',
      help: BUTTON_LINK_HELP,
    },
  ],
  brandStory: [
    {
      name: 'eyebrow',
      label: 'Small line above the heading',
      kind: 'text',
      placeholder: 'e.g. Our story',
    },
    { name: 'heading', label: 'Heading', kind: 'text' },
    { name: 'body', label: 'Text', kind: 'textarea', rows: 6 },
  ],
};

/** Form values for a section: missing text becomes "". */
function formValues(section: Section): FieldValues {
  const props: Record<string, unknown> = { ...section.props };
  for (const field of FIELDS[section.type]) {
    if (
      (field.kind === 'text' || field.kind === 'textarea') &&
      props[field.name] === undefined
    ) {
      props[field.name] = '';
    }
  }
  return props;
}

export const bannerName = (banner: DashboardBanner, index: number) =>
  banner.heading || `Banner ${index + 1}`;

/**
 * Edits one section's settings. The parent saves the result to the draft
 * and closes the dialog; `onSave` reports whether that worked.
 */
export function SectionForm({
  section,
  banners,
  submitLabel,
  onSave,
}: {
  section: Section;
  banners: DashboardBanner[];
  submitLabel: string;
  onSave: (section: Section) => Promise<boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const schema = sectionPropsSchemas[section.type] as unknown as z.ZodType<
    FieldValues,
    FieldValues
  >;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    resolver: zodResolver(schema),
    defaultValues: formValues(section),
  });

  const onSubmit = (props: FieldValues) =>
    startTransition(async () => {
      await onSave({ type: section.type, props } as Section);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate data-hydrated>
      <FieldGroup>
        {FIELDS[section.type].map((field) => (
          <SpecField
            key={field.name}
            field={field}
            register={register}
            control={control}
            errors={errors}
            banners={banners}
          />
        ))}
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function SpecField({
  field,
  register,
  control,
  errors,
  banners,
}: {
  field: FieldSpec;
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues>;
  errors: FieldErrors<FieldValues>;
  banners: DashboardBanner[];
}) {
  const id = `section-${field.name}`;
  const error = errors[field.name];
  const message = typeof error?.message === 'string' ? error.message : '';
  const invalid = Boolean(message);

  if (field.kind === 'banner' || field.kind === 'banners') {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel id={`${id}-label`}>{field.label}</FieldLabel>
        {field.help && <FieldDescription>{field.help}</FieldDescription>}
        <Controller
          control={control}
          name={field.name}
          render={({ field: { value, onChange } }) =>
            field.kind === 'banner' ? (
              <BannerChoice
                labelledBy={`${id}-label`}
                banners={banners}
                value={typeof value === 'string' ? value : ''}
                onChange={onChange}
              />
            ) : (
              <BannerSelection
                labelledBy={`${id}-label`}
                banners={banners}
                value={Array.isArray(value) ? (value as string[]) : undefined}
                onChange={onChange}
              />
            )
          }
        />
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
      </Field>
    );
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      {field.kind === 'text' && (
        <Input
          id={id}
          autoComplete="off"
          placeholder={field.placeholder}
          aria-invalid={invalid}
          {...register(field.name)}
        />
      )}
      {field.kind === 'textarea' && (
        <Textarea
          id={id}
          rows={field.rows}
          aria-invalid={invalid}
          {...register(field.name)}
        />
      )}
      {field.kind === 'count' && (
        <Controller
          control={control}
          name={field.name}
          render={({ field: { value, onChange, ref } }) => {
            const current = typeof value === 'number' ? value : undefined;
            const options =
              current && !field.options.includes(current)
                ? [...field.options, current].sort((a, b) => a - b)
                : field.options;
            return (
              <select
                id={id}
                ref={ref}
                className={selectClass}
                value={current ?? ''}
                onChange={(e) => onChange(Number(e.target.value))}
              >
                {options.map((n) => (
                  <option key={n} value={n}>
                    Up to {n} {field.unit}
                  </option>
                ))}
              </select>
            );
          }}
        />
      )}
      {field.kind === 'source' && (
        <select id={id} className={selectClass} {...register(field.name)}>
          <option value="newest">Newest products</option>
          <option value="featured">Featured products</option>
        </select>
      )}
      {field.help && <FieldDescription>{field.help}</FieldDescription>}
      <FieldError errors={[error as { message?: string } | undefined]} />
    </Field>
  );
}

function BannerOption({
  banner,
  index,
  control,
}: {
  banner: DashboardBanner;
  index: number;
  control: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 has-checked:border-primary has-checked:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      {control}
      <span className="relative aspect-[2/1] w-20 shrink-0 overflow-hidden rounded bg-muted">
        <StoreImage
          image={{ key: banner.imageKey, alt: '', width: 1920, height: 960 }}
          sizes="80px"
          fill
          alt=""
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {bannerName(banner, index)}
      </span>
      {banner.status !== 'live' && (
        <Badge variant="outline">
          {banner.status === 'scheduled' ? 'Scheduled' : 'Ended'}
        </Badge>
      )}
    </label>
  );
}

/** One banner (promo). */
function BannerChoice({
  labelledBy,
  banners,
  value,
  onChange,
}: {
  labelledBy: string;
  banners: DashboardBanner[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (banners.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a banner under Banners first.
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {banners.map((banner, i) => (
        <BannerOption
          key={banner.id}
          banner={banner}
          index={i}
          control={
            <input
              type="radio"
              name="promo-banner"
              className="sr-only"
              aria-label={bannerName(banner, i)}
              checked={value === banner.id}
              onChange={() => onChange(banner.id)}
            />
          }
        />
      ))}
    </div>
  );
}

/** All live banners (undefined), or chosen ones in library order (hero). */
function BannerSelection({
  labelledBy,
  banners,
  value,
  onChange,
}: {
  labelledBy: string;
  banners: DashboardBanner[];
  value: string[] | undefined;
  onChange: (ids: string[] | undefined) => void;
}) {
  const chosen = new Set(value ?? []);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(banners.filter((b) => next.has(b.id)).map((b) => b.id));
  };
  return (
    <div className="grid gap-2" role="group" aria-labelledby={labelledBy}>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="hero-banners"
            checked={value === undefined}
            onChange={() => onChange(undefined)}
          />
          All live banners
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="hero-banners"
            checked={value !== undefined}
            disabled={banners.length === 0}
            onChange={() => onChange([])}
          />
          Only the ones I choose
        </label>
      </div>
      {banners.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No banners yet. Add some under Banners; the hero stays hidden until
          one is live.
        </p>
      )}
      {value !== undefined && (
        <div className="grid gap-2">
          {banners.map((banner, i) => (
            <BannerOption
              key={banner.id}
              banner={banner}
              index={i}
              control={
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  aria-label={bannerName(banner, i)}
                  checked={chosen.has(banner.id)}
                  onChange={() => toggle(banner.id)}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
