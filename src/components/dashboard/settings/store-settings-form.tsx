'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useTransition, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
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
import { INDIAN_STATES } from '@/features/checkout/schema';
import {
  storeSettingsSchema,
  type StoreSettingsField,
  type StoreSettingsInput,
  type StoreSettingsValues,
} from '@/features/tenants/settings';
import { saveStoreSettings } from '@/features/tenants/settings-actions';
import { useHydrated } from '@/lib/use-hydrated';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Store name, WhatsApp number and contact details; live once saved. */
export function StoreSettingsForm({
  initial,
  storeUrl,
}: {
  initial: StoreSettingsInput;
  storeUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<StoreSettingsInput, unknown, StoreSettingsValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const onSubmit = (values: StoreSettingsValues) =>
    startTransition(async () => {
      try {
        const result = await saveStoreSettings(values);
        if (result.ok) {
          // What was typed is the new baseline; the saved copy (e.g. the
          // tidied WhatsApp number) arrives with the refreshed page.
          reset(undefined, { keepValues: true });
          toast.success('Saved. Your store shows the new details.');
          return;
        }
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(
            field as StoreSettingsField,
            { message },
            { shouldFocus: true },
          );
        }
        toast.error(result.error ?? 'Check the highlighted fields.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  // Field ids and the error/invalid wiring, kept short below.
  const field = (name: StoreSettingsField) => ({
    id: `settings-${name}`,
    'aria-invalid': Boolean(errors[name]),
    ...register(name),
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-hydrated={hydrated || undefined}
      className="grid gap-6"
    >
      <Section
        title="Store"
        description="Shown in your store's header, footer and browser tab."
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="settings-name">Store name</FieldLabel>
            <Input autoComplete="organization" {...field('name')} />
            {storeUrl && (
              <FieldDescription>
                Your store is at{' '}
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline underline-offset-4"
                >
                  {storeUrl.replace(/^https?:\/\//, '')}
                </a>
                . Ask the Zarify team to change the address.
              </FieldDescription>
            )}
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={Boolean(errors.whatsappNumber)}>
            <FieldLabel htmlFor="settings-whatsappNumber">
              WhatsApp number for orders
            </FieldLabel>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              {...field('whatsappNumber')}
            />
            <FieldDescription>
              Shoppers&apos; orders open a chat with this number. A 10-digit
              Indian mobile, or a full number with + and country code.
            </FieldDescription>
            <FieldError errors={[errors.whatsappNumber]} />
          </Field>
        </FieldGroup>
      </Section>

      <Section
        title="Contact details"
        description="Shown on your store's Contact page and in the footer. Leave out anything you do not want to share."
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="settings-email">Email</FieldLabel>
              <Input
                type="email"
                autoComplete="email"
                placeholder="hello@yourstore.in"
                {...field('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="settings-phone">Phone</FieldLabel>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="044 2345 6789"
                {...field('phone')}
              />
              <FieldDescription>If different from WhatsApp.</FieldDescription>
              <FieldError errors={[errors.phone]} />
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.addressLine1)}>
            <FieldLabel htmlFor="settings-addressLine1">
              Shop address
            </FieldLabel>
            <Input
              autoComplete="address-line1"
              placeholder="Shop number, street"
              {...field('addressLine1')}
            />
            <FieldDescription>
              For shoppers who visit. Leave the address empty if you sell online
              only.
            </FieldDescription>
            <FieldError errors={[errors.addressLine1]} />
          </Field>
          <Field data-invalid={Boolean(errors.addressLine2)}>
            <FieldLabel htmlFor="settings-addressLine2">
              Area or landmark
            </FieldLabel>
            <Input autoComplete="address-line2" {...field('addressLine2')} />
            <FieldError errors={[errors.addressLine2]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={Boolean(errors.city)}>
              <FieldLabel htmlFor="settings-city">City</FieldLabel>
              <Input autoComplete="address-level2" {...field('city')} />
              <FieldError errors={[errors.city]} />
            </Field>
            <Field data-invalid={Boolean(errors.state)}>
              <FieldLabel htmlFor="settings-state">State</FieldLabel>
              <select className={selectClass} {...field('state')}>
                <option value="">Choose…</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <FieldError errors={[errors.state]} />
            </Field>
            <Field data-invalid={Boolean(errors.pincode)}>
              <FieldLabel htmlFor="settings-pincode">PIN code</FieldLabel>
              <Input
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                {...field('pincode')}
              />
              <FieldError errors={[errors.pincode]} />
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.openingHours)}>
            <FieldLabel htmlFor="settings-openingHours">
              Opening hours
            </FieldLabel>
            <Input
              placeholder="e.g. Mon–Sat, 10 am – 8 pm"
              {...field('openingHours')}
            />
            <FieldError errors={[errors.openingHours]} />
          </Field>
        </FieldGroup>
      </Section>

      {/* One bar for the whole form, always in view: it saves both cards
          above (the Pages below save on their own). */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-60"
        data-testid="settings-save-bar"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {isDirty
              ? 'Unsaved changes to your store details'
              : 'Store details saved and live'}
          </span>
          <Button
            type="submit"
            disabled={pending || !isDirty}
            className="ml-auto"
          >
            {pending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </div>
    </form>
  );
}
