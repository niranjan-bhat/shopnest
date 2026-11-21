import { describe, expect, it } from 'vitest';
import { likePattern } from './dashboard';

describe('likePattern', () => {
  it('wraps the search in wildcards', () => {
    expect(likePattern('silk')).toBe('%silk%');
  });

  it('matches %, _ and backslash literally', () => {
    expect(likePattern(String.raw`50%_off\x`)).toBe(String.raw`%50\%\_off\\x%`);
  });
});
