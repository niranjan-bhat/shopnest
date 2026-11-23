import { z } from 'zod';
import { normalizeWhatsApp } from '@/features/tenants/settings';
import { SLUG_PATTERN } from '@/lib/slug';

// The "new store" form: shared by the browser (instant feedback) and the
// action (the real check). create_store in the database checks again.

/**
 * Subdomains stores cannot have: the platform uses them, or may. Keep in
 * step with create_store (supabase/migrations, 20261123130000).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...['admin', 'api', 'app', 'assets', 'auth', 'billing', 'blog', 'cdn'],
  ...['dashboard', 'dev', 'docs', 'email', 'ftp', 'help', 'images', 'login'],
  ...['mail', 'media', 'preview', 'send', 'shop', 'sites', 'smtp', 'staging'],
  ...['static', 'status', 'store', 'support', 'test', 'www', 'zarify'],
]);

export const STORE_SLUG_MIN = 3;
export const STORE_SLUG_MAX = 40;

export const BUSINESS_TYPES = [
  { value: 'saree', label: 'Saree shop' },
  { value: 'ethnic-wear', label: 'Ethnic wear' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'clothing', label: 'Other clothing' },
] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number]['value'];

export const newStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the store name')
    .max(120, 'Keep it under 120 characters'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(STORE_SLUG_MIN, `Use at least ${STORE_SLUG_MIN} characters`)
    .max(STORE_SLUG_MAX, `Keep it to ${STORE_SLUG_MAX} characters`)
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens')
    .refine((v) => !RESERVED_SLUGS.has(v), 'This address is reserved'),
  businessType: z.enum(
    BUSINESS_TYPES.map((t) => t.value) as [BusinessType, ...BusinessType[]],
    'Choose the type of business',
  ),
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (v) => normalizeWhatsApp(v) !== null,
      'Enter a 10-digit Indian mobile number, or a full number starting with +',
    )
    .transform((v) => normalizeWhatsApp(v) ?? v),
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Keep it under 254 characters')
    .pipe(z.email('Enter a valid email address')),
  templateKey: z.string().min(1, 'Choose a template').max(60),
  planId: z.uuid('Choose a plan'),
});

export type NewStoreInput = z.input<typeof newStoreSchema>;
export type NewStoreValues = z.output<typeof newStoreSchema>;
export type NewStoreField = keyof NewStoreValues;

/** The jsonb create_store returns. */
export const createStoreResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('created'), tenant_id: z.uuid() }),
  z.object({ status: z.literal('taken') }),
]);
