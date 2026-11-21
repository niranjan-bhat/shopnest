import 'server-only';
import { refresh, updateTag } from 'next/cache';
import { catalogTag } from './queries';

/**
 * After a dashboard change to a store's catalog: expire its cached
 * storefront data (so the next visitor sees the change) and refresh the
 * dashboard page the merchant is on. Server Actions only.
 */
export function catalogChanged(tenantId: string) {
  updateTag(catalogTag(tenantId));
  refresh();
}
