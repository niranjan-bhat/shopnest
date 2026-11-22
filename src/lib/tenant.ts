/**
 * Hostname routing, shared by proxy.ts and by code that builds links.
 *
 * With NEXT_PUBLIC_ROOT_DOMAIN = zarify.in (localhost:3000 locally):
 *   zarify.in, www.zarify.in  → platform (marketing site)
 *   app.zarify.in               → app (merchant dashboard, super admin, login)
 *   anything else                 → a storefront, looked up in tenant_domains
 */

export type HostRoute =
  { kind: 'platform' } | { kind: 'app' } | { kind: 'store'; hostname: string };

const HOSTNAME =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/**
 * A Host header (or the root domain setting) as a bare, lower-case host name
 * without port or trailing dot. Null when it is missing or malformed.
 */
export function normalizeHostname(
  host: string | null | undefined,
): string | null {
  if (!host) return null;
  const hostname = host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  return hostname.length <= 253 && HOSTNAME.test(hostname) ? hostname : null;
}

/** What a request to `hostHeader` is for, or null for an unusable host. */
export function routeHost(
  hostHeader: string | null | undefined,
  rootDomain: string,
): HostRoute | null {
  const host = normalizeHostname(hostHeader);
  const root = normalizeHostname(rootDomain);
  if (!host || !root) return null;
  if (host === root || host === `www.${root}`) return { kind: 'platform' };
  if (host === `app.${root}`) return { kind: 'app' };
  return { kind: 'store', hostname: host };
}

/** Paths that belong to the app host (dashboard, admin, sign-in, preview). */
export function isAppPath(pathname: string): boolean {
  return /^\/(dashboard|admin|login|auth|preview)(\/|$)/.test(pathname);
}

const isLocal = (hostname: string) =>
  hostname === 'localhost' || hostname.endsWith('.localhost');

/**
 * Absolute origin for a host name under the platform's conventions: http
 * with the root domain's port locally, https otherwise.
 */
export function originFor(hostname: string, rootDomain: string): string {
  if (!isLocal(hostname)) return `https://${hostname}`;
  const port = /:(\d+)$/.exec(rootDomain)?.[1];
  return `http://${hostname}${port ? `:${port}` : ''}`;
}

/** Origin of the app host (dashboard, admin, login). */
export function appOrigin(rootDomain: string): string {
  const root = normalizeHostname(rootDomain);
  if (!root) throw new Error(`Invalid root domain: ${rootDomain}`);
  return originFor(`app.${root}`, rootDomain);
}
