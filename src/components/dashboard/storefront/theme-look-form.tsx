'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from 'cn';
import {
  useEffect,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { saveThemeLook } from '@/features/theme/actions';
import { storeFonts } from '@/features/theme/fonts';
import {
  colourWarnings,
  RADIUS_OPTIONS,
  themeLookSchema,
  type ThemeLook,
} from '@/features/theme/look';
import { FONT_NAMES } from '@/features/theme/schema';
import { tokensToCssVars } from '@/features/theme/tokens';
import { useHydrated } from '@/lib/use-hydrated';
import { ImageField } from './image-field';

const COLOURS: {
  key: keyof ThemeLook['colors'];
  label: string;
  help: string;
}[] = [
  { key: 'primary', label: 'Brand colour', help: 'Buttons, links and prices.' },
  { key: 'accent', label: 'Accent', help: 'Highlights such as sale badges.' },
  {
    key: 'background',
    label: 'Background',
    help: 'The page behind everything.',
  },
  { key: 'text', label: 'Text', help: 'Headings and body text.' },
];

const RADIUS_LABELS: Record<(typeof RADIUS_OPTIONS)[number], string> = {
  none: 'Square',
  sm: 'Subtle',
  md: 'Rounded',
  lg: 'Soft',
};
const RADIUS_PX = { none: 0, sm: 4, md: 10, lg: 18 } as const;

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Branding, colours, fonts and corners; saves to the draft theme. */
export function ThemeLookForm({
  initial,
  storeName,
  uploadsEnabled,
}: {
  initial: ThemeLook;
  storeName: string;
  uploadsEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<ThemeLook>({
    resolver: zodResolver(themeLookSchema),
    defaultValues: initial,
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = form;
  const values = useWatch({ control }) as ThemeLook;
  const warnings = colourWarnings(values.colors);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const onSubmit = (look: ThemeLook) =>
    startTransition(async () => {
      try {
        const result = await saveThemeLook(look);
        if (result.ok) {
          reset(look);
          toast.success('Draft saved. Preview it, then publish.');
          return;
        }
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as FieldPath<ThemeLook>, { message });
        }
        toast.error(result.error ?? 'Check the highlighted fields.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  // A small live sample, styled exactly like the store.
  const fonts = storeFonts({
    heading: values.headingFont,
    body: values.bodyFont,
  });
  const sampleStyle = {
    ...tokensToCssVars({
      colors: values.colors,
      fonts: { heading: values.headingFont, body: values.bodyFont },
      radius: values.radius,
    }),
    ...fonts.style,
  } as CSSProperties;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () =>
        toast.error('Check the highlighted fields.'),
      )}
      noValidate
      className="grid gap-6 pb-24"
      data-hydrated={hydrated || undefined}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          <Section title="Branding">
            <FieldGroup>
              <Field data-invalid={Boolean(errors.logoKey)}>
                <FieldLabel>Logo</FieldLabel>
                <Controller
                  control={control}
                  name="logoKey"
                  render={({ field }) => (
                    <ImageField
                      kind="logo"
                      label="Logo"
                      value={field.value}
                      onChange={field.onChange}
                      uploadsEnabled={uploadsEnabled}
                      error={errors.logoKey?.message}
                    />
                  )}
                />
                <FieldDescription>
                  Shown in the header. Without one, your store name is shown in
                  your heading font. A wide PNG with a transparent background
                  works best.
                </FieldDescription>
              </Field>
              <Field data-invalid={Boolean(errors.faviconKey)}>
                <FieldLabel>Browser tab icon</FieldLabel>
                <Controller
                  control={control}
                  name="faviconKey"
                  render={({ field }) => (
                    <ImageField
                      kind="favicon"
                      label="Browser tab icon"
                      value={field.value}
                      onChange={field.onChange}
                      uploadsEnabled={uploadsEnabled}
                      previewClassName="size-12"
                      error={errors.faviconKey?.message}
                    />
                  )}
                />
                <FieldDescription>
                  A square image, at least 64 × 64.
                </FieldDescription>
              </Field>
              <Field data-invalid={Boolean(errors.tagline)}>
                <FieldLabel htmlFor="theme-tagline">Tagline</FieldLabel>
                <Input
                  id="theme-tagline"
                  placeholder="e.g. Handwoven silks from Kanchipuram"
                  aria-invalid={Boolean(errors.tagline)}
                  {...register('tagline')}
                />
                <FieldDescription>
                  Shown in the footer and in search results.
                </FieldDescription>
                <FieldError errors={[errors.tagline]} />
              </Field>
              <Field data-invalid={Boolean(errors.announcement)}>
                <FieldLabel htmlFor="theme-announcement">
                  Announcement bar
                </FieldLabel>
                <Input
                  id="theme-announcement"
                  placeholder="e.g. Free shipping across India above ₹5,000"
                  aria-invalid={Boolean(errors.announcement)}
                  {...register('announcement')}
                />
                <FieldDescription>
                  A short line above the header. Leave empty to hide it.
                </FieldDescription>
                <FieldError errors={[errors.announcement]} />
              </Field>
            </FieldGroup>
          </Section>

          <Section
            title="Colours"
            description="Button text is picked automatically so it stays readable."
          >
            <FieldGroup>
              {COLOURS.map((colour) => {
                const error = errors.colors?.[colour.key];
                const warning = warnings.find((w) => w.field === colour.key);
                return (
                  <Field key={colour.key} data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor={`colour-${colour.key}`}>
                      {colour.label}
                    </FieldLabel>
                    <Controller
                      control={control}
                      name={`colors.${colour.key}`}
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={
                              /^#[0-9a-f]{6}$/i.test(field.value)
                                ? field.value.toLowerCase()
                                : '#000000'
                            }
                            onChange={(e) => field.onChange(e.target.value)}
                            aria-label={`${colour.label} colour picker`}
                            className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
                          />
                          <Input
                            id={`colour-${colour.key}`}
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            className="w-28 font-mono uppercase"
                            aria-invalid={Boolean(error)}
                            spellCheck={false}
                          />
                        </div>
                      )}
                    />
                    <FieldDescription>{colour.help}</FieldDescription>
                    {error && (
                      <FieldError>Use a colour like #7A1F2B.</FieldError>
                    )}
                    {warning && (
                      <p
                        className="text-sm text-amber-700"
                        data-testid={`warning-${colour.key}`}
                      >
                        {warning.message}
                      </p>
                    )}
                  </Field>
                );
              })}
            </FieldGroup>
          </Section>

          <Section title="Fonts and corners">
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="theme-heading-font">
                    Heading font
                  </FieldLabel>
                  <select
                    id="theme-heading-font"
                    className={selectClass}
                    {...register('headingFont')}
                  >
                    {FONT_NAMES.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="theme-body-font">Body font</FieldLabel>
                  <select
                    id="theme-body-font"
                    className={selectClass}
                    {...register('bodyFont')}
                  >
                    {FONT_NAMES.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Corners</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RADIUS_OPTIONS.map((radius) => (
                    <label
                      key={radius}
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-muted/50"
                    >
                      <span
                        aria-hidden
                        className="h-8 w-14 border-2 border-foreground/40"
                        style={{ borderRadius: RADIUS_PX[radius] }}
                      />
                      <span>
                        <input
                          type="radio"
                          value={radius}
                          className="mr-1.5 accent-primary"
                          {...register('radius')}
                        />
                        {RADIUS_LABELS[radius]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </FieldGroup>
          </Section>
        </div>

        <div className="lg:sticky lg:top-20">
          <p className="mb-2 text-sm font-medium">Sample</p>
          <div
            className={cn(
              fonts.className,
              'overflow-hidden rounded-xl border bg-store-bg font-store-body text-store-text',
            )}
            style={sampleStyle}
            data-testid="theme-sample"
          >
            {values.announcement && (
              <p className="bg-store-primary px-3 py-1.5 text-center text-xs text-store-on-primary">
                {values.announcement}
              </p>
            )}
            <div className="p-5">
              <p className="font-store-heading text-2xl">{storeName}</p>
              <p className="mt-2 text-sm opacity-80">
                {values.tagline || 'Handwoven, made to be treasured.'}
              </p>
              <p className="mt-4 font-store-heading text-lg text-store-primary">
                ₹24,500
              </p>
              <span className="mt-4 inline-block rounded-store bg-store-primary px-4 py-2 text-sm text-store-on-primary">
                Add to bag
              </span>
              <span className="mt-4 ml-2 inline-block rounded-store bg-store-accent px-2 py-1 text-xs text-store-on-accent">
                New
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
          <span className="text-sm text-muted-foreground">
            {isDirty
              ? 'Unsaved changes'
              : 'Saved to the draft. Publish to make it live.'}
          </span>
          <Button
            type="submit"
            disabled={pending || !isDirty}
            className="ml-auto"
          >
            {pending ? 'Saving…' : 'Save draft'}
          </Button>
        </div>
      </div>
    </form>
  );
}
