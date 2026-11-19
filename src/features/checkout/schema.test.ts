import { describe, expect, it } from 'vitest';
import { checkoutSchema, formatAddress, normalizeIndianMobile } from './schema';

const valid = {
  name: 'Asha Rao',
  phone: '+91 98765 43210',
  addressLine1: '12 MG Road',
  addressLine2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  notes: '',
};

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['098765-43210', '9876543210'],
    ['919876543210', '9876543210'],
  ])('accepts %j', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['12345', '5876543210', '98765432101', 'abc'])(
    'rejects %j',
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );
});

describe('checkoutSchema', () => {
  it('accepts a valid form and normalises the phone', () => {
    const result = checkoutSchema.parse(valid);
    expect(result.phone).toBe('9876543210');
    expect(formatAddress(result)).toBe(
      '12 MG Road, Bengaluru, Karnataka 560001',
    );
  });

  it('reports each invalid field', () => {
    const result = checkoutSchema.safeParse({
      ...valid,
      name: 'A',
      phone: '12345',
      pincode: '012345',
      state: 'Atlantis',
    });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'phone', 'pincode', 'state']),
    );
  });

  it('trims input and caps notes length', () => {
    expect(checkoutSchema.parse({ ...valid, city: '  Pune ' }).city).toBe(
      'Pune',
    );
    expect(
      checkoutSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});
