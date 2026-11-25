import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { signInKey } = await import('./limits');

describe('signInKey', () => {
  it('is a stable keyed hash, different per kind and secret', () => {
    const key = signInKey('email', 'a@b.co', 's');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(signInKey('email', 'a@b.co', 's'));
    expect(key).not.toBe(signInKey('network', 'a@b.co', 's'));
    expect(key).not.toBe(signInKey('email', 'a@b.co', 'other'));
  });
});
