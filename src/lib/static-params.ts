/**
 * With Cache Components, every `generateStaticParams` must return at least
 * one entry; an empty list is an error in dev and fails `next build`. A new
 * store has no products yet, so its lists are often empty. In that case we
 * prebuild one placeholder that is never a valid slug or host name: its page
 * renders "not found", and real paths still render on demand.
 */
export const PLACEHOLDER_PARAM = '_';

export function atLeastOne<Key extends string>(
  key: Key,
  values: readonly string[],
): Record<Key, string>[] {
  const list = values.length > 0 ? values : [PLACEHOLDER_PARAM];
  return list.map((value) => ({ [key]: value }) as Record<Key, string>);
}
