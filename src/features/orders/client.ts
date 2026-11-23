import 'server-only';
import { createHmac } from 'node:crypto';

// The shopper's network address, for place_order's limit of 10 orders an
// hour per network. Only a keyed hash of it is ever stored or sent to the
// database; without the server's secret it cannot be turned back into the
// address.

/** Loopback addresses: development and the test suite. */
function isLocal(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === 'localhost' ||
    /^127\./.test(ip) ||
    /^::ffff:127\./.test(ip)
  );
}

/**
 * The client's address as the host reports it (Vercel sets x-real-ip and
 * x-forwarded-for itself), or null when there is none or it is local.
 */
export function clientAddress(headers: Headers): string | null {
  const ip = (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0] ??
    ''
  ).trim();
  return ip && !isLocal(ip) ? ip : null;
}

/** 64 hex characters; the same address always gives the same hash. */
export function clientHash(ip: string, secret: string): string {
  return createHmac('sha256', `zarify-order-client:${secret}`)
    .update(ip)
    .digest('hex');
}
