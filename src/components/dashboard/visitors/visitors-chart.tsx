'use client';

import { useState } from 'react';

export type ChartDay = { day: string; visitors: number };

const dayLabel = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
  timeZone: 'UTC',
});
const shortLabel = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const date = (day: string) => new Date(`${day}T00:00:00Z`);
const people = (n: number) => `${n} ${n === 1 ? 'visitor' : 'visitors'}`;

/** Visitors per day as bars; the table below it holds the same numbers. */
export function VisitorsChart({ daily }: { daily: ChartDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.visitors), 1);
  const shown = active === null ? null : daily[active];

  return (
    <div>
      {/* The day pointed at, kept above the bars so it covers nothing. */}
      <p className="flex h-5 justify-between text-xs text-muted-foreground">
        <span>{max}</span>
        {shown && (
          <span className="text-foreground" data-testid="chart-day">
            {dayLabel.format(date(shown.day))}: {people(shown.visitors)}
          </span>
        )}
      </p>
      <div
        role="img"
        aria-label={`Visitors per day, up to ${max} in a day`}
        className="flex h-32 items-stretch gap-0.5 border-t border-b border-border"
        onPointerLeave={() => setActive(null)}
      >
        {daily.map((d, i) => (
          <div
            key={d.day}
            className="flex min-w-0 flex-1 items-end justify-center"
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          >
            <div
              className={`w-full max-w-6 rounded-t-sm transition-colors ${
                active === i ? 'bg-foreground' : 'bg-foreground/60'
              }`}
              style={{
                height: `${(d.visitors / max) * 100}%`,
                minHeight: d.visitors > 0 ? 3 : 0,
              }}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{shortLabel.format(date(daily[0].day))}</span>
        <span>Today</span>
      </p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Show as a table
        </summary>
        <table className="mt-2 w-full max-w-xs text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 text-right font-normal">Visitors</th>
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day} className="border-t">
                <td className="py-1">{dayLabel.format(date(d.day))}</td>
                <td className="py-1 text-right tabular-nums">{d.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
