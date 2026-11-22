import { z } from 'zod';
import type { ThemeConfig } from './schema';

// Banners: the store's library of hero and promo images. Banners save at
// once (not through the theme draft); the home page sections choose which to
// show. These schemas run in the browser (instant feedback) and in the
// Server Actions (the real check).

export const MAX_BANNERS = 20;

/**
 * Banner dates are typed as Indian time: a <input type="datetime-local">
 * value, "YYYY-MM-DDTHH:mm". India has no daylight saving, so the offset is
 * fixed.
 */
const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-11-25T09:00" in India → ISO timestamp, or null if invalid. */
export function istToIso(local: string): string | null {
  if (!LOCAL_DATETIME.test(local)) return null;
  const date = new Date(`${local}:00${IST_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects dates the Date parser rolled over, e.g. 31 November.
  if (isoToIst(date.toISOString()) !== local) return null;
  return date.toISOString();
}

/** A timestamp as Indian time for a datetime-local input. */
export function isoToIst(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS)
    .toISOString()
    .slice(0, 16);
}

/** "25 Nov 2026, 9:00 am" in Indian time. */
export function formatIst(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * Where a banner leads: a page of the store ("/c/kanjivaram") or a full web
 * address. Nothing else, so no "javascript:" links reach shoppers.
 */
export function isBannerLink(value: string): boolean {
  if (value.startsWith('/')) {
    return !value.startsWith('//') && !/[\s\\]/.test(value);
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

const dateField = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || istToIso(v) !== null,
    'Enter a valid date and time',
  );

export const bannerFormSchema = z
  .object({
    heading: z
      .string()
      .trim()
      .max(100, 'Keep the heading under 100 characters'),
    link: z
      .string()
      .trim()
      .max(300, 'Keep the link under 300 characters')
      .refine(
        (v) => v === '' || isBannerLink(v),
        'Use a store page such as /c/sarees, or a full address starting with https://',
      ),
    /** Empty: shown from now on. */
    startsAt: dateField,
    /** Empty: shown until removed. */
    endsAt: dateField,
  })
  .refine(
    (v) => {
      const start = v.startsAt && istToIso(v.startsAt);
      const end = v.endsAt && istToIso(v.endsAt);
      return !start || !end || end > start;
    },
    { path: ['endsAt'], message: 'End after the start' },
  );

export type BannerFormValues = z.infer<typeof bannerFormSchema>;
export type BannerField = keyof BannerFormValues;

export const newBannerSchema = z.object({
  imageKey: z.string().max(300),
  values: bannerFormSchema,
});

export const bannerIdSchema = z.uuid();

export const bannerOrderSchema = z
  .array(bannerIdSchema)
  .min(1)
  .max(MAX_BANNERS * 2)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate banner');

/** The columns a form saves; empty fields become null. */
export function bannerRow(values: BannerFormValues) {
  return {
    heading: values.heading || null,
    link: values.link || null,
    starts_at: values.startsAt ? istToIso(values.startsAt) : null,
    ends_at: values.endsAt ? istToIso(values.endsAt) : null,
  };
}

export type BannerStatus = 'live' | 'scheduled' | 'ended';

/** Whether shoppers can see a banner now (the same rule as the RLS policy). */
export function bannerStatus(
  banner: { startsAt: string | null; endsAt: string | null },
  now: Date,
): BannerStatus {
  if (banner.endsAt && new Date(banner.endsAt) <= now) return 'ended';
  if (banner.startsAt && new Date(banner.startsAt) > now) return 'scheduled';
  return 'live';
}

export type BannerUse = 'hero' | 'promo';

/**
 * Home sections that name this banner, in the draft or the live theme. A hero
 * that lists no banners shows all of them and is not counted.
 */
export function bannerUses(
  bannerId: string,
  themes: (ThemeConfig | null)[],
): BannerUse[] {
  const uses = new Set<BannerUse>();
  for (const theme of themes) {
    for (const section of theme?.sections ?? []) {
      if (
        section.type === 'hero' &&
        section.props.bannerIds?.includes(bannerId)
      ) {
        uses.add('hero');
      }
      if (
        section.type === 'promoBanner' &&
        section.props.bannerId === bannerId
      ) {
        uses.add('promo');
      }
    }
  }
  return [...uses];
}
