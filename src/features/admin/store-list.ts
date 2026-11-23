import { z } from 'zod';
import type { Enums } from '@/types/database';

// The super admin store list's filters, without any database access.

export type TenantStatus = Enums<'tenant_status'>;

export const TENANT_STATUSES = [
  'onboarding',
  'active',
  'suspended',
] as const satisfies readonly TenantStatus[];

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  onboarding: 'Not live yet',
  active: 'Live',
  suspended: 'Suspended',
};

export type StoreListFilter = {
  status: TenantStatus | 'all';
  /** Part of the store's name or address. */
  search: string;
  /** 1-based. */
  page: number;
};

const filterSchema = z.object({
  status: z.enum(['all', ...TENANT_STATUSES]).catch('all'),
  search: z.string().trim().max(80).catch(''),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export function parseStoreListFilter(
  params: Record<string, string | string[] | undefined>,
): StoreListFilter {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return filterSchema.parse({
    status: first(params.status) ?? 'all',
    search: first(params.q) ?? '',
    page: first(params.page) ?? 1,
  });
}

/** The list's URL. */
export function storeListHref(filter: Partial<StoreListFilter>): string {
  const params = new URLSearchParams();
  if (filter.status && filter.status !== 'all') {
    params.set('status', filter.status);
  }
  if (filter.search) params.set('q', filter.search);
  if (filter.page && filter.page > 1) params.set('page', String(filter.page));
  const query = params.toString();
  return `/admin${query ? `?${query}` : ''}`;
}

/**
 * A search as a PostgREST `or` filter on name and slug. The value is quoted,
 * so commas and brackets in it cannot add conditions.
 */
export function storeSearch(search: string): string {
  const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const quoted = `"${like.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  return `name.ilike.${quoted},slug.ilike.${quoted}`;
}
