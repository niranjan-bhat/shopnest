import { describe, expect, it } from 'vitest';
import { networkOf } from './network';

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
