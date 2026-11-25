import type { VisitEvent } from './schema';

// Reports what a shopper does to the store's own /visit address. Nothing is
// sent until <CountVisits> turns it on, so previews are never counted.

const TEAM_KEY = 'zarify-team';

let on = false;
const sent = new Set<string>();

export function setCounting(value: boolean) {
  on = value;
}

/**
 * Whether this browser belongs to the store's team: it once came here from
 * the dashboard. Remembered, so the team's own visits are left out.
 */
export function isTeamBrowser(referrer: string, appOrigin: string): boolean {
  try {
    if (referrer.startsWith(`${appOrigin}/`)) {
      window.localStorage.setItem(TEAM_KEY, '1');
      return true;
    }
    return window.localStorage.getItem(TEAM_KEY) === '1';
  } catch {
    return false;
  }
}

/** Once per thing and page load; the server counts each once a day. */
export function countVisit(visit: VisitEvent) {
  if (!on) return;
  const body = JSON.stringify(visit);
  if (sent.has(body)) return;
  sent.add(body);
  try {
    navigator.sendBeacon('/visit', body);
  } catch {
    // Counting never gets in a shopper's way.
  }
}
