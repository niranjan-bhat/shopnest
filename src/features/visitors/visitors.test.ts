import { describe, expect, it, vi } from 'vitest';
import { parseVisitorDays, visitSchema } from './schema';

vi.mock('server-only', () => ({}));
const { indiaDay, isBot, visitKeys } = await import('./record');

describe('isBot', () => {
  it.each([
    '',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'facebookexternalhit/1.1',
    'WhatsApp/2.23.20.0 A',
    'Mozilla/5.0 HeadlessChrome/140.0',
    'curl/8.5.0',
  ])('leaves out %s', (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/140.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Mobile Instagram 350.0',
    'Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20) Chrome/120.0 Mobile',
  ])('counts %s', (ua) => {
    expect(isBot(ua)).toBe(false);
  });
});

it('uses the day in India', () => {
  expect(indiaDay(new Date('2026-11-25T18:29:00Z'))).toBe('2026-11-25');
  expect(indiaDay(new Date('2026-11-25T18:31:00Z'))).toBe('2026-11-26');
});

describe('visitKeys', () => {
  const visit = { tenantId: 't', ip: '49.36.1.2', userAgent: 'x', day: 'd1' };
  const key = (change: Partial<typeof visit> = {}, secret = 's') =>
    visitKeys({ ...visit, ...change }, secret);

  it('is the same person within a store and day only', () => {
    expect(key().person).toMatch(/^[0-9a-f]{64}$/);
    expect(key()).toEqual(key());
    for (const other of [
      key({ day: 'd2' }),
      key({ tenantId: 'u' }),
      key({}, 'other'),
    ]) {
      expect(other.person).not.toBe(key().person);
      expect(other.network).not.toBe(key().network);
    }
  });

  it('tells browsers on one network apart', () => {
    expect(key({ userAgent: 'y' }).person).not.toBe(key().person);
    expect(key({ userAgent: 'y' }).network).toBe(key().network);
  });
});

it('accepts only known events', () => {
  expect(visitSchema.safeParse({ event: 'bag' }).success).toBe(true);
  expect(visitSchema.safeParse({ event: 'product' }).success).toBe(false);
  expect(visitSchema.safeParse({ event: 'order' }).success).toBe(false);
});

it('reads the range', () => {
  expect(parseVisitorDays('30')).toBe(30);
  expect(parseVisitorDays('1')).toBe(1);
  for (const bad of [undefined, '2', 'x', ['1', '7']]) {
    expect(parseVisitorDays(bad)).toBe(7);
  }
});
