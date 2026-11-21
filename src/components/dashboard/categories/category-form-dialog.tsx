'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { saveCategory } from '@/features/catalog/category-actions';
import type { DashboardCategory } from '@/features/catalog/dashboard';
import {
  categoryFormSchema,
  type CategoryField,
  type CategoryFormInput,
  type CategoryFormValues,
} from '@/features/catalog/schemas';
import { slugify } from '@/lib/slug';

/** Add a category (no `category`) or edit one. */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: DashboardCategory;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit category' : 'Add category'}
          </DialogTitle>
          <DialogDescription>
            Categories appear in your store&apos;s menu and on the home page.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts fresh. */}
        <CategoryForm category={category} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: DashboardCategory;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      isActive: category?.isActive ?? true,
    },
  });
  const name = useWatch({ control, name: 'name' });
  const slug = useWatch({ control, name: 'slug' });
  const suggested = slugify(name ?? '');
  const shown = slug?.trim().toLowerCase() || suggested;

  const onSubmit = (values: CategoryFormValues) =>
    startTransition(async () => {
      try {
        const result = await saveCategory(category?.id ?? null, values);
        if (result.ok) {
          toast.success(category ? 'Category saved' : 'Category added');
          onDone();
          return;
        }
        const fieldErrors = Object.entries(result.fieldErrors ?? {});
        for (const [field, message] of fieldErrors) {
          setError(field as CategoryField, { message }, { shouldFocus: true });
        }
        if (result.error) toast.error(result.error);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="category-name">Name</FieldLabel>
          <Input
            id="category-name"
            autoComplete="off"
            placeholder="e.g. Kanjivaram sarees"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={Boolean(errors.slug)}>
          <FieldLabel htmlFor="category-slug">URL</FieldLabel>
          <Input
            id="category-slug"
            autoComplete="off"
            placeholder={suggested || 'e.g. sarees'}
            aria-invalid={Boolean(errors.slug)}
            {...register('slug')}
          />
          <FieldDescription>
            Shoppers see <span className="font-mono">/c/{shown || '…'}</span>.
            Leave empty to make it from the name.
          </FieldDescription>
          <FieldError errors={[errors.slug]} />
        </Field>
        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="category-active"
                aria-label="Show in store"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <FieldLabel htmlFor="category-active">Show in store</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : category ? 'Save' : 'Add category'}
        </Button>
      </DialogFooter>
    </form>
  );
}
