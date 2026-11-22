import { z } from 'zod';
import {
  INDIAN_STATES,
  normalizeIndianMobile,
} from '@/features/checkout/schema';
import type { Json, Tables } from '@/types/database';

// Store details from Settings: name, WhatsApp number and contact details.
// They save straight away (not through the theme draft). Shared by the
// browser (instant feedback) and the save action (the real check).

export type StoreAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

/** How shoppers reach the store; shown on the contact page and footer. */
export type StoreContact = {
  email: string | null;
  /** As the merchant typed it; links use its digits. */
  phone: string | null;
  address: StoreAddress | null;
  openingHours: string | null;
};

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
});

/** A stored address, or null when it is missing or malformed. */
export function parseAddress(raw: Json | null): StoreAddress | null {
  const parsed = addressSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function toStoreContact(
  row: Pick<
    Tables<'tenants'>,
    'contact_email' | 'contact_phone' | 'address' | 'opening_hours'
  >,
): StoreContact {
  return {
    email: row.contact_email,
    phone: row.contact_phone,
    address: parseAddress(row.address),
    openingHours: row.opening_hours,
  };
}

/** The tenant columns that make up StoreContact. */
export const CONTACT_COLUMNS =
  'contact_email, contact_phone, address, opening_hours' as const;

/**
 * A WhatsApp number as E.164: a 10-digit Indian mobile (with or without
 * +91 or a leading 0) becomes +91…; other countries need the + and code.
 */
export function normalizeWhatsApp(input: string): string | null {
  const indian = normalizeIndianMobile(input);
  if (indian) return `+91${indian}`;
  const compact = input.replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

/** "+919876543210" → "+91 98765 43210"; other numbers are left as they are. */
export function formatWhatsApp(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

/** One line for the contact page and footer. */
export function addressLines(address: StoreAddress): string[] {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.pincode}`,
  ].filter((line): line is string => Boolean(line));
}

/** Google Maps directions to the address (no API key needed). */
export function directionsUrl(storeName: string, address: StoreAddress) {
  const query = [storeName, ...addressLines(address)].join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const tooLong = (max: number) => `Keep it under ${max} characters`;

export const storeSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your store name')
      .max(120, tooLong(120)),
    // Checked here, tidied to E.164 at the end, so other fields' errors
    // still show while this one is wrong.
    whatsappNumber: z
      .string()
      .trim()
      .refine(
        (v) => normalizeWhatsApp(v) !== null,
        'Enter a 10-digit Indian mobile number, or a full number starting with +',
      ),
    email: z
      .string()
      .trim()
      .max(254, tooLong(254))
      .refine(
        (v) => v === '' || z.email().safeParse(v).success,
        'Enter a valid email address',
      ),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || /^\+?[0-9 ()-]{6,20}$/.test(v),
        'Use digits, spaces and an optional + only',
      ),
    addressLine1: z.string().trim().max(120, tooLong(120)),
    addressLine2: z.string().trim().max(120, tooLong(120)),
    city: z.string().trim().max(60, tooLong(60)),
    state: z.union([z.literal(''), z.enum(INDIAN_STATES)]),
    pincode: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || /^[1-9]\d{5}$/.test(v),
        'Enter a valid 6-digit PIN code',
      ),
    openingHours: z.string().trim().max(200, tooLong(200)),
  })
  .superRefine((v, ctx) => {
    // The address is optional, but all or nothing (line 2 aside).
    const parts = [v.addressLine1, v.city, v.state, v.pincode];
    if (parts.every((p) => p === '') && v.addressLine2 === '') return;
    const missing: [keyof typeof v, string][] = [
      ['addressLine1', 'Enter the street address'],
      ['city', 'Enter the city'],
      ['state', 'Choose the state'],
      ['pincode', 'Enter the PIN code'],
    ];
    for (const [field, message] of missing) {
      if (v[field] === '')
        ctx.addIssue({ code: 'custom', path: [field], message });
    }
  })
  .transform((v) => ({
    ...v,
    whatsappNumber: normalizeWhatsApp(v.whatsappNumber) ?? v.whatsappNumber,
  }));

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
export type StoreSettingsValues = z.output<typeof storeSettingsSchema>;
export type StoreSettingsField = keyof StoreSettingsValues;

/** The form's values for a store. */
export function settingsFormValues(store: {
  name: string;
  whatsappNumber: string;
  contact: StoreContact;
}): StoreSettingsInput {
  const { contact } = store;
  return {
    name: store.name,
    whatsappNumber: formatWhatsApp(store.whatsappNumber),
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    addressLine1: contact.address?.line1 ?? '',
    addressLine2: contact.address?.line2 ?? '',
    city: contact.address?.city ?? '',
    state: (contact.address?.state ?? '') as StoreSettingsInput['state'],
    pincode: contact.address?.pincode ?? '',
    openingHours: contact.openingHours ?? '',
  };
}

/** The tenant columns a save writes; empty fields become null. */
export function settingsRow(values: StoreSettingsValues) {
  const address: StoreAddress | null = values.addressLine1
    ? {
        line1: values.addressLine1,
        ...(values.addressLine2 ? { line2: values.addressLine2 } : {}),
        city: values.city,
        state: values.state,
        pincode: values.pincode,
      }
    : null;
  return {
    name: values.name,
    whatsapp_number: values.whatsappNumber,
    contact_email: values.email || null,
    contact_phone: values.phone || null,
    address,
    opening_hours: values.openingHours || null,
  };
}
