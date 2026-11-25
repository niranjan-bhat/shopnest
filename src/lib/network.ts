/**
 * What counts as one network: an IPv4 address, or the first half (/64) of an
 * IPv6 one, since a single connection can use any address inside its /64.
 */
export function networkOf(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.toLowerCase().split('%')[0].split('::');
  const groups = head ? head.split(':') : [];
  if (tail !== undefined) {
    const rest = tail ? tail.split(':') : [];
    const zeros = Math.max(0, 8 - groups.length - rest.length);
    groups.push(...Array<string>(zeros).fill('0'), ...rest);
  }
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':');
}
