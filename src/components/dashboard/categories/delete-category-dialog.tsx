'use client';

import { useTransition } from 'react';
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
import { deleteCategory } from '@/features/catalog/category-actions';
import type { DashboardCategory } from '@/features/catalog/dashboard';

export function DeleteCategoryDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean;
  /** Kept after closing, so the text does not change while it fades out. */
  category: DashboardCategory | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const count = category?.productCount ?? 0;

  const confirm = () => {
    if (!category) return;
    startTransition(async () => {
      try {
        const result = await deleteCategory(category.id);
        if (!result.ok) {
          toast.error(result.error ?? 'Could not delete the category.');
          return;
        }
        toast.success(`Deleted ${category.name}`);
        onOpenChange(false);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {category?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {count === 0
              ? 'No products are in this category.'
              : `${count} ${count === 1 ? 'product stays' : 'products stay'} in your store but will no longer be listed under this category.`}{' '}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
