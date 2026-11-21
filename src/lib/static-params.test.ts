import { describe, expect, it } from 'vitest';
import { normalizeHostname } from './tenant';
import { SLUG_PATTERN } from './slug';
import { atLeastOne, PLACEHOLDER_PARAM } from './static-params';

describe('atLeastOne', () => {
  it('maps values to params', () => {
    expect(atLeastOne('product', ['a', 'b'])).toEqual([
      { product: 'a' },
      { product: 'b' },
    ]);
  });

  it('returns the placeholder when there is nothing to prebuild', () => {
    expect(atLeastOne('category', [])).toEqual([
      { category: PLACEHOLDER_PARAM },
    ]);
  });

  it('uses a placeholder that can never be a real slug or host name', () => {
    expect(PLACEHOLDER_PARAM).not.toMatch(SLUG_PATTERN);
    expect(normalizeHostname(PLACEHOLDER_PARAM)).toBeNull();
  });
});
