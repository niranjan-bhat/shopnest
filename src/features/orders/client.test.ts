import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { clientAddress, clientHash } = await import('./client');

const headers = (values: Record<string, string>) => new Headers(values);

describe('clientAddress', () => {
  it('takes the address the host reports', () => {
    expect(clientAddress(headers({ 'x-real-ip': '49.36.10.2' }))).toBe(
      '49.36.10.2',
    );
    expect(
      clientAddress(headers({ 'x-forwarded-for': '49.36.10.2, 10.0.0.1' })),
    ).toBe('49.36.10.2');
  });

  it('ignores local and missing addresses', () => {
    expect(clientAddress(headers({}))).toBeNull();
    expect(clientAddress(headers({ 'x-forwarded-for': '::1' }))).toBeNull();
    expect(clientAddress(headers({ 'x-real-ip': '127.0.0.1' }))).toBeNull();
    expect(
      clientAddress(headers({ 'x-forwarded-for': '::ffff:127.0.0.1' })),
    ).toBeNull();
  });
});

describe('clientHash', () => {
  it('is stable for an address and secret, and differs otherwise', () => {
    const hash = clientHash('49.36.10.2', 'secret');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(clientHash('49.36.10.2', 'secret'));
    expect(hash).not.toBe(clientHash('49.36.10.3', 'secret'));
    expect(hash).not.toBe(clientHash('49.36.10.2', 'other'));
  });
});
