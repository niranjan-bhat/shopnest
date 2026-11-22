import { describe, expect, it } from 'vitest';
import {
  addressLines,
  directionsUrl,
  formatWhatsApp,
  normalizeWhatsApp,
  parseAddress,
  settingsFormValues,
  settingsRow,
  storeSettingsSchema,
  type StoreSettingsInput,
} from './settings';

const blank: StoreSettingsInput = {
  name: 'Tara Weaves',
  whatsappNumber: '98765 43210',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  openingHours: '',
};

describe('WhatsApp numbers', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+44 7911 123456', '+447911123456'],
  ])('reads %s as %s', (input, expected) => {
    expect(normalizeWhatsApp(input)).toBe(expected);
  });

  it.each(['12345', '5876543210', '1234 567890', 'call me'])(
    'rejects %s',
    (input) => expect(normalizeWhatsApp(input)).toBeNull(),
  );

  it('formats Indian numbers for reading', () => {
    expect(formatWhatsApp('+919876543210')).toBe('+91 98765 43210');
    expect(formatWhatsApp('+447911123456')).toBe('+447911123456');
  });
});

describe('storeSettingsSchema', () => {
  it('saves a store with no contact details', () => {
    const values = storeSettingsSchema.parse(blank);
    expect(settingsRow(values)).toEqual({
      name: 'Tara Weaves',
      whatsapp_number: '+919876543210',
      contact_email: null,
      contact_phone: null,
      address: null,
      opening_hours: null,
    });
  });

  it('needs the whole address once any of it is given', () => {
    const result = storeSettingsSchema.safeParse({
      ...blank,
      city: 'Chennai',
    });
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(['addressLine1', 'state', 'pincode']);
  });

  it('checks email, phone and PIN', () => {
    const result = storeSettingsSchema.safeParse({
      ...blank,
      email: 'not-an-email',
      phone: 'call me',
      addressLine1: '12 Silk Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '012345',
    });
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(['email', 'phone', 'pincode']);
  });

  it('round-trips a full store through the form', () => {
    const values = storeSettingsSchema.parse({
      ...blank,
      email: 'hello@taraweaves.in',
      phone: '044 2345 6789',
      addressLine1: '14 Sannathi Street',
      addressLine2: '',
      city: 'Kanchipuram',
      state: 'Tamil Nadu',
      pincode: '631502',
      openingHours: 'Mon–Sat, 10 am – 8 pm',
    });
    const row = settingsRow(values);
    expect(row.address).toEqual({
      line1: '14 Sannathi Street',
      city: 'Kanchipuram',
      state: 'Tamil Nadu',
      pincode: '631502',
    });
    const form = settingsFormValues({
      name: row.name,
      whatsappNumber: row.whatsapp_number,
      contact: {
        email: row.contact_email,
        phone: row.contact_phone,
        address: parseAddress(row.address),
        openingHours: row.opening_hours,
      },
    });
    expect(form).toEqual({
      ...blank,
      whatsappNumber: '+91 98765 43210',
      email: 'hello@taraweaves.in',
      phone: '044 2345 6789',
      addressLine1: '14 Sannathi Street',
      city: 'Kanchipuram',
      state: 'Tamil Nadu',
      pincode: '631502',
      openingHours: 'Mon–Sat, 10 am – 8 pm',
    });
  });
});

describe('addresses', () => {
  const address = {
    line1: '14 Sannathi Street',
    line2: 'Near the temple',
    city: 'Kanchipuram',
    state: 'Tamil Nadu',
    pincode: '631502',
  };

  it('ignores malformed stored addresses', () => {
    expect(parseAddress(null)).toBeNull();
    expect(parseAddress({ line1: 'x' })).toBeNull();
    expect(parseAddress(address)).toEqual(address);
  });

  it('prints lines and a directions link', () => {
    expect(addressLines(address)).toEqual([
      '14 Sannathi Street',
      'Near the temple',
      'Kanchipuram, Tamil Nadu 631502',
    ]);
    const url = new URL(directionsUrl('Tara Weaves', address));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('query')).toBe(
      'Tara Weaves, 14 Sannathi Street, Near the temple, Kanchipuram, Tamil Nadu 631502',
    );
  });
});
