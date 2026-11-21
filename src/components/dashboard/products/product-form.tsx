'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
  type FieldPath,
} from 'react-hook-form';
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
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { deleteProduct, saveProduct } from '@/features/catalog/product-actions';
import {
  productFormSchema,
  PRODUCT_STATUSES,
  type ProductFormValues,
} from '@/features/catalog/product-schema';
import { slugify } from '@/lib/slug';
import { STATUS_BADGE } from './status-badge';
import { ProductDetailsFields } from './product-details-fields';
import { ProductOptions } from './product-options';

const FAILED = 'Something went wrong. Please try again.';

const STATUS_HELP: Record<(typeof PRODUCT_STATUSES)[number], string> = {
  draft: 'Only you can see it. Shoppers cannot.',
  active: 'Live in your store.',
  archived: 'Hidden from your store and lists, kept for your records.',
};

export type CategoryChoice = { id: string; name: string; isActive: boolean };

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

/** Add a product (no `productId`) or edit one. */
export function ProductForm({
  productId,
  initial,
  categories,
  liveUrl,
  photos,
}: {
  productId: string | null;
  initial: ProductFormValues;
  categories: CategoryChoice[];
  /** The product's storefront page, when it is live. */
  liveUrl: string | null;
  /** The photos panel; photos save on their own, not with this form. */
  photos: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initial,
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = form;
  const name = useWatch({ control, name: 'name' });
  const slug = useWatch({ control, name: 'slug' });
  const priceMode = useWatch({ control, name: 'priceMode' });
  const status = useWatch({ control, name: 'status' });
  const shownSlug = slug?.trim().toLowerCase() || slugify(name ?? '');

  // Warn before leaving with unsaved changes (closing the tab, reloading).
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const onSubmit = (values: ProductFormValues) =>
    startTransition(async () => {
      try {
        const result = await saveProduct(productId, values);
        if (result.ok) {
          toast.success(productId ? 'Product saved' : 'Product added');
          if (productId) {
            // Not dirty any more; the page then reloads with the saved
            // product (new variant ids) and the form restarts from it.
            form.reset(values);
          } else {
            // Next.js keeps visited pages mounted (hidden) for instant back
            // navigation, so empty this form before leaving it: the next
            // "Add product" must start blank, not with this product.
            form.reset(initial);
            router.replace(`/dashboard/products/${result.id}`);
          }
          return;
        }
        for (const [path, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          const field = (
            path === 'variants' ? 'variants.root' : path
          ) as FieldPath<ProductFormValues>;
          setError(field, { message });
        }
        if (result.error) toast.error(result.error);
        else toast.error('Check the highlighted fields.');
      } catch {
        toast.error(FAILED);
      }
    });

  const onInvalid = () => toast.error('Check the highlighted fields.');

  const remove = () => {
    if (!productId) return;
    startTransition(async () => {
      try {
        const result = await deleteProduct(productId);
        if (!result.ok) {
          toast.error(result.error ?? FAILED);
          return;
        }
        toast.success('Product deleted');
        form.reset(initial);
        router.replace('/dashboard/products');
      } catch {
        toast.error(FAILED);
      }
    });
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="grid gap-6 pb-24"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/products"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            aria-label="Back to products"
          >
            <ArrowLeft aria-hidden />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">
            {productId ? initial.name : 'Add product'}
          </h1>
          {productId && (
            <Badge variant={STATUS_BADGE[initial.status].variant}>
              {STATUS_BADGE[initial.status].label}
            </Badge>
          )}
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink aria-hidden />
              View in store
            </a>
          )}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="grid gap-6">
            <Section
              title="Photos"
              description="The first photo is the cover. Drag to reorder."
            >
              {photos}
            </Section>

            <Section title="Basics">
              <FieldGroup>
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="product-name">Name</FieldLabel>
                  <Input
                    id="product-name"
                    placeholder="e.g. Ruby temple-border Kanjivaram"
                    aria-invalid={Boolean(errors.name)}
                    {...register('name')}
                  />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field data-invalid={Boolean(errors.slug)}>
                  <FieldLabel htmlFor="product-slug">URL</FieldLabel>
                  <Input
                    id="product-slug"
                    placeholder={slugify(name ?? '') || 'e.g. ruby-kanjivaram'}
                    aria-invalid={Boolean(errors.slug)}
                    {...register('slug')}
                  />
                  <FieldDescription>
                    Shoppers see{' '}
                    <span className="font-mono">/p/{shownSlug || '…'}</span>.
                    Leave empty to make it from the name.
                  </FieldDescription>
                  <FieldError errors={[errors.slug]} />
                </Field>
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="product-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="product-description"
                    rows={5}
                    placeholder="The weave, the story, how it drapes…"
                    aria-invalid={Boolean(errors.description)}
                    {...register('description')}
                  />
                  <FieldError errors={[errors.description]} />
                </Field>
              </FieldGroup>
            </Section>

            <Section title="Price">
              <FieldGroup>
                <fieldset className="grid gap-2">
                  <legend className="sr-only">How is it priced?</legend>
                  {(
                    [
                      [
                        'fixed',
                        'Fixed price',
                        'Shoppers see the price and order.',
                      ],
                      [
                        'on_request',
                        'Price on request',
                        'You confirm the price on WhatsApp (for made-to-order or bridal pieces).',
                      ],
                    ] as const
                  ).map(([value, label, help]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-muted/50"
                    >
                      <input
                        type="radio"
                        value={value}
                        className="mt-1 size-4 accent-primary"
                        {...register('priceMode')}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {label}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {help}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {priceMode === 'fixed' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.price)}>
                      <FieldLabel htmlFor="product-price">Price (₹)</FieldLabel>
                      <Input
                        id="product-price"
                        inputMode="decimal"
                        placeholder="e.g. 24500"
                        aria-invalid={Boolean(errors.price)}
                        {...register('price')}
                      />
                      <FieldError errors={[errors.price]} />
                    </Field>
                    <Field data-invalid={Boolean(errors.compareAt)}>
                      <FieldLabel htmlFor="product-compare">
                        Compare-at price (₹)
                      </FieldLabel>
                      <Input
                        id="product-compare"
                        inputMode="decimal"
                        placeholder="Optional"
                        aria-invalid={Boolean(errors.compareAt)}
                        {...register('compareAt')}
                      />
                      <FieldDescription>
                        The original price, shown struck through.
                      </FieldDescription>
                      <FieldError errors={[errors.compareAt]} />
                    </Field>
                  </div>
                )}
              </FieldGroup>
            </Section>

            <Section
              title="Sizes, colours and stock"
              description="Stock is tracked for each size and colour."
            >
              <ProductOptions saved={initial.variants} />
            </Section>

            <Section
              title="Details"
              description="Shown on the product page. Fill in what applies."
            >
              <ProductDetailsFields />
            </Section>

            <Section
              title="Search engines"
              description="Optional. How the product appears in Google results."
            >
              <FieldGroup>
                <Field data-invalid={Boolean(errors.seoTitle)}>
                  <FieldLabel htmlFor="product-seo-title">
                    Page title
                  </FieldLabel>
                  <Input
                    id="product-seo-title"
                    placeholder={name || 'Defaults to the product name'}
                    aria-invalid={Boolean(errors.seoTitle)}
                    {...register('seoTitle')}
                  />
                  <FieldError errors={[errors.seoTitle]} />
                </Field>
                <Field data-invalid={Boolean(errors.seoDescription)}>
                  <FieldLabel htmlFor="product-seo-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="product-seo-description"
                    rows={2}
                    placeholder="Defaults to the product description"
                    aria-invalid={Boolean(errors.seoDescription)}
                    {...register('seoDescription')}
                  />
                  <FieldError errors={[errors.seoDescription]} />
                </Field>
              </FieldGroup>
            </Section>
          </div>

          <div className="grid gap-6 lg:sticky lg:top-20">
            <Section title="Status">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="product-status" className="sr-only">
                    Status
                  </FieldLabel>
                  <select
                    id="product-status"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    {...register('status')}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  <FieldDescription>{STATUS_HELP[status]}</FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Controller
                    control={control}
                    name="isFeatured"
                    render={({ field }) => (
                      <Switch
                        id="product-featured"
                        aria-label="Featured"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <FieldLabel htmlFor="product-featured">
                    Featured on the home page
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </Section>

            <Section title="Categories">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories yet.{' '}
                  <Link
                    href="/dashboard/categories"
                    className="underline underline-offset-4"
                  >
                    Create categories
                  </Link>{' '}
                  to group your products.
                </p>
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="sr-only">Categories</legend>
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        value={category.id}
                        className="size-4 accent-primary"
                        {...register('categoryIds')}
                      />
                      {category.name}
                      {!category.isActive && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </label>
                  ))}
                </fieldset>
              )}
            </Section>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
            {productId && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleting(true)}
                disabled={pending}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {isDirty ? 'Unsaved changes' : ''}
            </span>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : productId ? 'Save' : 'Add product'}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {initial.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its sizes, stock and category links are deleted too. To hide it
              but keep it, set the status to Archived instead. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}
