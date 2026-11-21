import { describe, expect, it } from 'vitest';
import {
  appOrigin,
  isAppPath,
  normalizeHostname,
  originFor,
  routeHost,
} from './tenant';

describe('normalizeHostname', () => {
  it.each([
    ['Saree-Demo.Localhost:3000', 'saree-demo.localhost'],
    ['shop.example.com.', 'shop.example.com'],
    ['localhost', 'localhost'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected);
  });

  it.each([null, '', 'bad host', 'evil.com/path', '-x.com', 'a..b'])(
    'rejects %s',
    (input) => {
      expect(normalizeHostname(input)).toBeNull();
    },
  );
});

describe('routeHost', () => {
  const local = 'localhost:3000';
  const prod = 'zarify.in';

  it('sends the root domain and www to the platform site', () => {
    expect(routeHost('localhost:3000', local)).toEqual({ kind: 'platform' });
    expect(routeHost('zarify.in', prod)).toEqual({ kind: 'platform' });
    expect(routeHost('www.zarify.in', prod)).toEqual({ kind: 'platform' });
  });

  it('sends app.<root> to the app', () => {
    expect(routeHost('app.localhost:3000', local)).toEqual({ kind: 'app' });
    expect(routeHost('APP.zarify.in', prod)).toEqual({ kind: 'app' });
  });

  it('treats every other host as a storefront, without the port', () => {
    expect(routeHost('saree-demo.localhost:3000', local)).toEqual({
      kind: 'store',
      hostname: 'saree-demo.localhost',
    });
    expect(routeHost('www.merchant.com', prod)).toEqual({
      kind: 'store',
      hostname: 'www.merchant.com',
    });
  });

  it('rejects missing or malformed hosts', () => {
    expect(routeHost(null, prod)).toBeNull();
    expect(routeHost('a b', prod)).toBeNull();
  });
});

describe('isAppPath', () => {
  it.each([
    '/dashboard',
    '/dashboard/products',
    '/admin',
    '/login',
    '/auth/callback',
  ])('%s is an app path', (path) => expect(isAppPath(path)).toBe(true));
  it.each(['/', '/c/silk', '/p/admin-saree', '/dashboards', '/loginx'])(
    '%s is not',
    (path) => expect(isAppPath(path)).toBe(false),
  );
});

describe('origins', () => {
  it('uses http and the dev port locally', () => {
    expect(originFor('saree-demo.localhost', 'localhost:3000')).toBe(
      'http://saree-demo.localhost:3000',
    );
    expect(appOrigin('localhost:3000')).toBe('http://app.localhost:3000');
  });

  it('uses https in production', () => {
    expect(originFor('saree-demo.zarify.in', 'zarify.in')).toBe(
      'https://saree-demo.zarify.in',
    );
    expect(appOrigin('zarify.in')).toBe('https://app.zarify.in');
  });
});
