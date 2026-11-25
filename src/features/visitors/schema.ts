import { z } from 'zod';

/** What a store page reports, and the server counts. */
export const visitSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('visit') }),
  z.object({ event: z.literal('product'), product: z.uuid() }),
  z.object({ event: z.literal('bag') }),
  z.object({ event: z.literal('chat') }),
]);
export type VisitEvent = z.infer<typeof visitSchema>;

/** Days the Visitors card can show. */
export const VISITOR_RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
] as const;

const rangeSchema = z.coerce
  .number()
  .refine((days) => VISITOR_RANGES.some((range) => range.days === days))
  .catch(7);

/** The overview's ?days=, or 7 for anything else. */
export function parseVisitorDays(value: string | string[] | undefined): number {
  return rangeSchema.parse(value);
}

export const visitorStatsSchema = z.object({
  daily: z.array(z.object({ day: z.string(), visitors: z.number() })).min(1),
  bag: z.number(),
  chats: z.number(),
  orders: z.number(),
  products: z.array(
    z.object({ id: z.uuid(), name: z.string(), visitors: z.number() }),
  ),
});
export type VisitorStats = z.infer<typeof visitorStatsSchema>;
