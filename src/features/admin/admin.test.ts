import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inviteMessage } from './invite';
import { parseStoreListFilter, storeListHref, storeSearch } from './store-list';
import { newStoreSchema, RESERVED_SLUGS } from './store-schema';

const valid = {
  name: ' Tara Weaves ',
  slug: 'Tara-Weaves',
  businessType: 'saree',
  whatsappNumber: '98765 43210',
  ownerEmail: ' Owner@Example.com ',
  templateKey: 'silk',
  planId: '00000000-0000-4000-8000-000000000001',
};

const errorsFor = (changes: object) => {
  const result = newStoreSchema.safeParse({ ...valid, ...changes });
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

describe('newStoreSchema', () => {
  it('tidies what was typed', () => {
    expect(newStoreSchema.parse(valid)).toMatchObject({
      name: 'Tara Weaves',
      slug: 'tara-weaves',
      whatsappNumber: '+919876543210',
      ownerEmail: 'owner@example.com',
    });
  });

  it.each(['ab', 'a'.repeat(41), 'has space', 'double--dash', '-edge', 'www'])(
    'refuses the address %s',
    (slug) => {
      expect(errorsFor({ slug })).toContain('slug');
    },
  );

  it('checks every other field', () => {
    const fields = errorsFor({
      name: ' ',
      businessType: 'cars',
      whatsappNumber: '123',
      ownerEmail: 'nope',
      templateKey: '',
      planId: '',
    });
    expect(fields).toEqual([
      'name',
      'businessType',
      'whatsappNumber',
      'ownerEmail',
      'templateKey',
      'planId',
    ]);
  });

  it('reserves the same addresses as the database', () => {
    const sql = readFileSync(
      'supabase/migrations/20261123130000_create_store.sql',
      'utf8',
    );
    const list = /any \(array\[([^\]]+)\]/.exec(sql)?.[1] ?? '';
    const reserved = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(new Set(reserved)).toEqual(new Set(RESERVED_SLUGS));
  });
});

describe('store list', () => {
  it('falls back on bad filters', () => {
    expect(parseStoreListFilter({ status: 'x', page: '-1' })).toEqual({
      status: 'all',
      search: '',
      page: 1,
    });
  });

  it('links to a filtered page', () => {
    expect(storeListHref({})).toBe('/admin');
    expect(storeListHref({ status: 'active', search: 'a b', page: 2 })).toBe(
      '/admin?status=active&q=a+b&page=2',
    );
  });

  it('quotes the search, so it cannot add conditions', () => {
    expect(storeSearch('a,b')).toBe('name.ilike."%a,b%",slug.ilike."%a,b%"');
    expect(storeSearch('x"y')).toContain('"%x\\"y%"');
  });
});

describe('inviteMessage', () => {
  it('says where and how to sign in', () => {
    const text = inviteMessage({
      storeName: 'Tara Weaves',
      email: 'owner@example.com',
      loginUrl: 'https://app.zarify.in/login',
    });
    expect(text).toContain('Tara Weaves');
    expect(text).toContain('https://app.zarify.in/login');
    expect(text).toContain('owner@example.com');
  });
});
