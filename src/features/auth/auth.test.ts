import { describe, expect, it } from 'vitest';
import { safeNextPath, sendCodeSchema, verifyCodeSchema } from './schemas';

describe('sign-in schemas', () => {
  it('normalises the email', () => {
    expect(sendCodeSchema.parse({ email: '  Owner@Example.COM ' })).toEqual({
      email: 'owner@example.com',
    });
  });

  it('rejects a bad email', () => {
    expect(sendCodeSchema.safeParse({ email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('accepts only a 6-digit code', () => {
    const base = { email: 'a@b.co' };
    expect(
      verifyCodeSchema.safeParse({ ...base, code: ' 123456 ' }).success,
    ).toBe(true);
    for (const code of ['12345', '1234567', 'abcdef', '']) {
      expect(verifyCodeSchema.safeParse({ ...base, code }).success).toBe(false);
    }
  });
});

describe('safeNextPath', () => {
  it.each([
    '/dashboard',
    '/dashboard/products',
    '/admin',
    '/admin/tenants',
    '/preview',
  ])('keeps %s', (path) => expect(safeNextPath(path)).toBe(path));

  it.each([
    'https://evil.example',
    '//evil.example',
    '/dashboard//evil.example',
    '/login',
    '/sites/x',
    'dashboard',
    null,
    42,
  ])('replaces %s with /dashboard', (next) => {
    expect(safeNextPath(next)).toBe('/dashboard');
  });
});
