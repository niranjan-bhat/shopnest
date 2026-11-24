// Billing works in whole days in India, as "YYYY-MM-DD" (a Postgres date).

const isoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const readable = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export function todayInIndia(now: Date = new Date()): string {
  return isoDay.format(now);
}

/** "2026-11-23" → "23 Nov 2026". */
export function formatDay(day: string): string {
  return readable.format(new Date(`${day}T00:00:00Z`));
}

/** Due on a day means overdue from the next one. ISO days sort as text. */
export function isOverdue(nextDue: string | null, today: string): boolean {
  return nextDue !== null && nextDue < today;
}
