import { getPublicEnv } from './env.public';

/**
 * Turns a stored R2 object key into a URL. The database only ever holds keys.
 *
 * NEXT_PUBLIC_MEDIA_BASE_URL is the bucket's domain in production and
 * /mock-media (files in /public) locally.
 */
export function mediaUrl(key: string): string {
  if (/^[a-z]+:\/\//i.test(key) || key.startsWith('/')) {
    throw new Error(`Expected an R2 object key, got a URL or path: ${key}`);
  }
  const base = getPublicEnv().NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/+$/, '');
  return `${base}/${key}`;
}
