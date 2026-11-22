import { describe, expect, it } from 'vitest';
import {
  bannerFormSchema,
  bannerRow,
  bannerStatus,
  bannerUses,
  formatIst,
  isBannerLink,
  isoToIst,
  istToIso,
} from './banners';
import { DEFAULT_THEME } from './defaults';
import type { ThemeConfig } from './schema';

const form = {
  heading: '',
  link: '',
  startsAt: '',
  endsAt: '',
};

describe('banner dates', () => {
  it('reads form dates as Indian time', () => {
    expect(istToIso('2026-11-25T09:00')).toBe('2026-11-25T03:30:00.000Z');
    // Midnight in India is the evening before in UTC.
    expect(istToIso('2026-12-01T00:00')).toBe('2026-11-30T18:30:00.000Z');
  });

  it('round-trips through the form', () => {
    expect(isoToIst('2026-11-25T03:30:00.000Z')).toBe('2026-11-25T09:00');
    expect(isoToIst(istToIso('2027-01-01T23:45') ?? '')).toBe(
      '2027-01-01T23:45',
    );
  });

  it('rejects dates that do not exist or are malformed', () => {
    expect(istToIso('2026-11-31T10:00')).toBeNull();
    expect(istToIso('2026-11-25')).toBeNull();
    expect(istToIso('2026-11-25T25:00')).toBeNull();
    expect(istToIso('')).toBeNull();
  });

  it('formats in Indian time', () => {
    expect(formatIst('2026-11-25T03:30:00.000Z')).toMatch(/25 Nov 2026/);
    expect(formatIst('2026-11-25T03:30:00.000Z')).toMatch(/9:00/);
  });
});

describe('banner links', () => {
  it.each(['/c/kanjivaram', '/p/ruby-silk', '/', 'https://instagram.com/x'])(
    'accepts %s',
    (link) => expect(isBannerLink(link)).toBe(true),
  );

  it.each([
    'javascript:alert(1)',
    '//evil.example',
    'c/sarees',
    '/c/with space',
    'https://localhost',
    'ftp://files.example.com',
    'data:text/html,hi',
  ])('rejects %s', (link) => expect(isBannerLink(link)).toBe(false));
});

describe('bannerFormSchema', () => {
  it('accepts an empty form (always shown, no heading or link)', () => {
    expect(bannerFormSchema.safeParse(form).success).toBe(true);
  });

  it('needs the end after the start', () => {
    const result = bannerFormSchema.safeParse({
      ...form,
      startsAt: '2026-11-25T09:00',
      endsAt: '2026-11-25T09:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endsAt']);
  });

  it('flags an invalid link on the link field', () => {
    const result = bannerFormSchema.safeParse({ ...form, link: 'sarees' });
    expect(result.error?.issues[0]?.path).toEqual(['link']);
  });

  it('turns empty fields into nulls for the row', () => {
    const values = bannerFormSchema.parse({
      heading: '  Diwali edit ',
      link: '',
      startsAt: '2026-11-25T09:00',
      endsAt: '',
    });
    expect(bannerRow(values)).toEqual({
      heading: 'Diwali edit',
      link: null,
      starts_at: '2026-11-25T03:30:00.000Z',
      ends_at: null,
    });
  });
});

describe('bannerStatus', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  it('is live with no dates or inside the window', () => {
    expect(bannerStatus({ startsAt: null, endsAt: null }, now)).toBe('live');
    expect(
      bannerStatus(
        { startsAt: '2026-11-25T11:00:00Z', endsAt: '2026-11-26T00:00:00Z' },
        now,
      ),
    ).toBe('live');
  });

  it('is scheduled before the start and ended from the end on', () => {
    expect(
      bannerStatus({ startsAt: '2026-11-25T12:00:01Z', endsAt: null }, now),
    ).toBe('scheduled');
    expect(
      bannerStatus({ startsAt: null, endsAt: '2026-11-25T12:00:00Z' }, now),
    ).toBe('ended');
  });
});

describe('bannerUses', () => {
  const id = 'a6000000-0000-4000-8000-000000000001';
  const withSections = (sections: ThemeConfig['sections']): ThemeConfig => ({
    ...DEFAULT_THEME,
    sections,
  });

  it('ignores a hero that shows every banner', () => {
    expect(bannerUses(id, [DEFAULT_THEME, null])).toEqual([]);
  });

  it('finds heroes and promos that name the banner, draft or live', () => {
    const draft = withSections([
      {
        type: 'hero',
        props: { bannerIds: [id], ctaLabel: 'Shop', ctaHref: '/' },
      },
    ]);
    const live = withSections([
      { type: 'promoBanner', props: { bannerId: id, heading: 'Sale' } },
    ]);
    expect(bannerUses(id, [draft, live])).toEqual(['hero', 'promo']);
    expect(bannerUses('other', [draft, live])).toEqual([]);
  });
});
