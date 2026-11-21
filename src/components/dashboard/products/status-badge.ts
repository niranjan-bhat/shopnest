import type { ProductStatus } from '@/features/catalog/product-schema';

/** Badge text and style for a product status (list and edit form). */
export const STATUS_BADGE: Record<
  ProductStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  active: { label: 'Active', variant: 'default' },
  draft: { label: 'Draft', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
};
