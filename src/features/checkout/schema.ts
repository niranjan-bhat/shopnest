import { z } from 'zod';

/** Indian mobile number from common inputs: "+91 98765 43210", "098765-43210". */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(max, `Keep ${label} under ${max} characters`);

/**
 * Checkout form. Used by the client form now; Phase 4's createOrder server
 * action validates the same schema on the server.
 */
export const checkoutSchema = z.object({
  name: text('name', 80).pipe(z.string().min(2, 'Enter your full name')),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeIndianMobile(value);
      if (!normalized) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter a 10-digit Indian mobile number',
        });
        return z.NEVER;
      }
      return normalized;
    }),
  addressLine1: text('address', 120),
  addressLine2: z.string().trim().max(120).optional().default(''),
  city: text('city', 60),
  state: z.enum(INDIAN_STATES, { message: 'Choose your state' }),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
  notes: z.string().trim().max(500).optional().default(''),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;

export function formatAddress(values: CheckoutValues): string {
  return [
    values.addressLine1,
    values.addressLine2,
    `${values.city}, ${values.state} ${values.pincode}`,
  ]
    .filter(Boolean)
    .join(', ');
}
