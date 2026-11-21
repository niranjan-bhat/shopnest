/** URL slugs, matching the `public.slug` domain in the database. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 100;

/**
 * A URL slug from a name: "Kanjivaram Silk & Zari" → "kanjivaram-silk-zari".
 * Accents are dropped (é → e). Names written only in other scripts (e.g.
 * Devanagari) give an empty string, so callers must ask for a slug then.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '');
}
