/**
 * Turns a stored R2 object key into a URL. The database only ever holds keys.
 *
 * Phase 1 serves mock images from /public/mock-media. Phase 2 points this at
 * NEXT_PUBLIC_MEDIA_BASE_URL (the R2 bucket's custom domain).
 */
const MOCK_MEDIA_BASE = '/mock-media';

export function mediaUrl(key: string): string {
  if (/^[a-z]+:\/\//i.test(key) || key.startsWith('/')) {
    throw new Error(`Expected an R2 object key, got a URL or path: ${key}`);
  }
  return `${MOCK_MEDIA_BASE}/${key}`;
}
