import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { networkOf, signInKey } = await import('./limits');

describe('networkOf', () => {
  it.each([
    ['49.36.10.2', '49.36.10.2'],
    ['::ffff:49.36.10.2', '49.36.10.2'],
    ['2405:201:0012:a::1', '2405:201:12:a'],
    ['2405:201:12:a:ffff:1:2:3', '2405:201:12:a'],
    ['2405:201::5', '2405:201:0:0'],
  ])('%s counts as %s', (ip, network) => {
    expect(networkOf(ip)).toBe(network);
  });
});

describe('signInKey', () => {
  it('is a stable keyed hash, different per kind and secret', () => {
    const key = signInKey('email', 'a@b.co', 's');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(signInKey('email', 'a@b.co', 's'));
    expect(key).not.toBe(signInKey('network', 'a@b.co', 's'));
    expect(key).not.toBe(signInKey('email', 'a@b.co', 'other'));
  });
});
