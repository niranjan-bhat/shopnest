// Absolute URLs for the hosts the app serves locally. Chromium resolves any
// *.localhost name to the loopback address, so no hosts-file entries are
// needed.
export const PORT = Number(process.env.PORT ?? 3000);

/** A storefront URL, e.g. store('saree-demo', '/cart'). */
export function store(name: string, path = '/'): string {
  return `http://${name}.localhost:${PORT}${path}`;
}

/** The app host: dashboard, admin and sign-in. */
export function app(path = '/'): string {
  return `http://app.localhost:${PORT}${path}`;
}

/** The platform site. */
export function platform(path = '/'): string {
  return `http://localhost:${PORT}${path}`;
}

/** Mailpit (local Supabase's test inbox). */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
