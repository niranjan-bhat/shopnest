import 'server-only';
import { createHmac } from 'node:crypto';
import { clientAddress } from '@/features/orders/client';
import { networkOf } from '@/lib/network';
import { getServerEnv } from '@/lib/env';
import { adminDb } from '@/lib/supabase/admin';
import type { VisitEvent } from './schema';

/**
 * Search engines, link previews and tools that name themselves. Phones by
 * Cubot are people.
 */
export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase().replaceAll('cubot', '');
  return (
    ua === '' ||
    /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|whatsapp\/|preview|curl\/|wget|python|axios|node-fetch/.test(
      ua,
    )
  );
}

/** Today in India, where the stores are: "2026-11-26". */
export function indiaDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    now,
  );
}

/**
 * A person for one store on one day, and their network, as keyed hashes.
 * Neither says anything about another store or day.
 */
export function visitKeys(
  visit: { tenantId: string; ip: string; userAgent: string; day: string },
  secret: string,
): { person: string; network: string } {
  const network = networkOf(visit.ip);
  const hash = (...parts: string[]) =>
    createHmac('sha256', `zarify-visit:${secret}`)
      .update(JSON.stringify([visit.tenantId, visit.day, ...parts]))
      .digest('hex');
  return {
    person: hash('person', network, visit.userAgent),
    network: hash('network', network),
  };
}

/** Counts something a shopper did in a store. */
export async function recordVisit(
  tenantId: string,
  visit: VisitEvent,
  headers: Headers,
): Promise<void> {
  const userAgent = headers.get('user-agent') ?? '';
  if (isBot(userAgent)) return;
  const keys = visitKeys(
    {
      tenantId,
      // Local addresses (development, tests) are all one network.
      ip: clientAddress(headers) ?? 'local',
      userAgent,
      day: indiaDay(new Date()),
    },
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
  );
  const { error } = await adminDb().rpc('record_store_visit', {
    tid: tenantId,
    person: keys.person,
    net: keys.network,
    event: visit.event,
    product: visit.event === 'product' ? visit.product : undefined,
  });
  if (error) throw new Error(`Counting a visit failed: ${error.message}`);
}
