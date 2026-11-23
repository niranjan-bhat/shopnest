import { describe, expect, it } from 'vitest';
import {
  mergeStoreChoices,
  pickActiveStore,
  type StoreChoice,
} from './active-store';
import type { MyStore, StoreSummary } from './dashboard';

const summary = (id: string, name: string): StoreSummary => ({
  id,
  name,
  slug: id,
  status: 'active',
  suspendedReason: null,
  url: null,
});

const tara = summary('t1', 'Tara Weaves');
const noor = summary('t2', 'Noor Atelier');
const amba = summary('t3', 'Amba Silks');

describe('mergeStoreChoices', () => {
  const member: MyStore[] = [{ ...tara, role: 'staff' }];

  it('returns only member stores for ordinary users', () => {
    expect(mergeStoreChoices(member, null)).toEqual(member);
  });

  it('adds every other store for super admins, by name, after their own', () => {
    const choices = mergeStoreChoices(member, [tara, noor, amba]);
    expect(choices.map((s) => [s.name, s.role])).toEqual([
      ['Tara Weaves', 'staff'],
      ['Amba Silks', 'admin'],
      ['Noor Atelier', 'admin'],
    ]);
  });
});

describe('pickActiveStore', () => {
  const choices: StoreChoice[] = [
    { ...tara, role: 'owner' },
    { ...noor, role: 'owner' },
  ];

  it('uses the saved store', () => {
    expect(pickActiveStore(choices, 't2')?.name).toBe('Noor Atelier');
  });

  it('falls back to the first store when nothing is saved', () => {
    expect(pickActiveStore(choices, undefined)?.name).toBe('Tara Weaves');
  });

  it('ignores a saved store the user can no longer open', () => {
    expect(pickActiveStore(choices, 'gone')?.name).toBe('Tara Weaves');
  });

  it('returns null when the user has no stores', () => {
    expect(pickActiveStore([], 't1')).toBeNull();
  });
});
