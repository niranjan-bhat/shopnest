'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { saveStorePage } from '@/features/pages/actions';
import {
  PAGE_INFO,
  pageFormSchema,
  placeholdersIn,
  SAMPLE_PAGES,
  type PageField,
  type PageFormValues,
  type PageSlug,
} from '@/features/pages/content';
import { useHydrated } from '@/lib/use-hydrated';

/** Writes one information page; it is live once saved and shown. */
export function PageEditor({
  slug,
  initial,
  liveUrl,
}: {
  slug: PageSlug;
  initial: PageFormValues;
  /** The page on the store, when it is shown there. */
  liveUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmSample, setConfirmSample] = useState(false);
  const hydrated = useHydrated();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: initial,
  });
  const body = useWatch({ control, name: 'body' });
  const todo = placeholdersIn(body ?? '');

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const applySample = () => {
    setValue('body', SAMPLE_PAGES[slug], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConfirmSample(false);
  };

  const onSubmit = (values: PageFormValues) =>
    startTransition(async () => {
      try {
        const result = await saveStorePage(slug, values);
        if (result.ok) {
          reset(values);
          toast.success(
            values.isPublished
              ? 'Saved. The page is in your store.'
              : 'Saved. The page is hidden from your store.',
          );
          return;
        }
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as PageField, { message }, { shouldFocus: true });
        }
        if (result.error) toast.error(result.error);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-hydrated={hydrated || undefined}
      className="grid gap-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/settings"
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          aria-label="Back to settings"
        >
          <ArrowLeft aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">
          {PAGE_INFO[slug].title}
        </h1>
        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink aria-hidden />
            View in store
          </a>
        )}
      </div>

      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.title)}>
              <FieldLabel htmlFor="page-title">Title</FieldLabel>
              <Input
                id="page-title"
                autoComplete="off"
                aria-invalid={Boolean(errors.title)}
                {...register('title')}
              />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={Boolean(errors.body)}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <FieldLabel htmlFor="page-body">Text</FieldLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    body?.trim() ? setConfirmSample(true) : applySample()
                  }
                >
                  Start from a sample
                </Button>
              </div>
              <Textarea
                id="page-body"
                rows={18}
                aria-invalid={Boolean(errors.body)}
                aria-describedby="page-body-help"
                className="font-mono text-sm"
                {...register('body')}
              />
              <FieldDescription id="page-body-help">
                Leave a blank line between paragraphs. Start a line with
                &ldquo;- &rdquo; for a bullet point. The samples are a starting
                point, not legal advice: check them for your shop.
              </FieldDescription>
              {todo.length > 0 && (
                <p
                  className="text-sm text-amber-700 dark:text-amber-400"
                  data-testid="placeholders"
                >
                  Still to fill in: {todo.join(', ')}
                </p>
              )}
              <FieldError errors={[errors.body]} />
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={control}
                name="isPublished"
                render={({ field }) => (
                  <Switch
                    id="page-published"
                    aria-label="Show in store"
                    aria-describedby="page-published-help"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldContent>
                <FieldLabel htmlFor="page-published">Show in store</FieldLabel>
                <FieldDescription id="page-published-help">
                  Lists the page in your store&apos;s footer.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <AlertDialog open={confirmSample} onOpenChange={setConfirmSample}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace your text with the sample?
            </AlertDialogTitle>
            <AlertDialogDescription>
              What you have written so far is replaced. Nothing is saved until
              you press Save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction onClick={applySample}>
              Use the sample
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
