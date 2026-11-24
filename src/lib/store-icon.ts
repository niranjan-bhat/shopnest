/**
 * A browser tab icon for a store that has not uploaded one: its first letter
 * on its main colour. Merchants' stores must not show Zarify's icon.
 */
export function storeIcon(
  name: string,
  colors: { primary: string; background: string },
): string {
  const letter = /[\p{L}\p{N}]/u.exec(name)?.[0].toUpperCase() ?? '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${colors.primary}"/>` +
    `<text x="16" y="23" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="${colors.background}">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
