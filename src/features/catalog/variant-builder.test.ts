import { describe, expect, it } from 'vitest';
import {
  buildVariants,
  emptyVariant,
  optionKey,
  optionListsOf,
  variantLabel,
  type VariantDraft,
} from './variant-builder';

const saved = (
  id: string,
  options: VariantDraft['options'],
  stock: string,
): VariantDraft => ({ ...emptyVariant(options), id, stock });

describe('buildVariants', () => {
  it('gives a product without options one variant', () => {
    expect(buildVariants({ sizes: [], colours: [] }, [])).toEqual([
      emptyVariant({}),
    ]);
  });

  it('makes every colour × size, sizes in garment order', () => {
    const rows = buildVariants(
      { sizes: ['L', 'S'], colours: ['Rust', 'Teal'] },
      [],
    );
    expect(rows.map((r) => variantLabel(r.options))).toEqual([
      'Rust · S',
      'Rust · L',
      'Teal · S',
      'Teal · L',
    ]);
  });

  it('keeps rows the form already has', () => {
    const current = [saved('v-m', { size: 'M' }, '7')];
    const rows = buildVariants({ sizes: ['M', 'L'], colours: [] }, current);
    expect(rows[0]).toBe(current[0]);
    expect(rows[1]).toEqual(emptyVariant({ size: 'L' }));
  });

  it('brings back a saved variant that was removed and re-added', () => {
    const original = [saved('v-m', { size: 'M' }, '7')];
    const afterRemoving = buildVariants(
      { sizes: ['L'], colours: [] },
      original,
    );
    const afterReAdding = buildVariants(
      { sizes: ['L', 'M'], colours: [] },
      afterRemoving,
      original,
    );
    expect(afterReAdding.find((r) => r.options.size === 'M')).toMatchObject({
      id: 'v-m',
      stock: '7',
    });
  });
});

describe('optionKey', () => {
  it('ignores key order', () => {
    expect(optionKey({ size: 'M', colour: 'Rust' })).toBe(
      optionKey({ colour: 'Rust', size: 'M' }),
    );
  });
});

describe('optionListsOf', () => {
  it('collects sizes in garment order and colours as found', () => {
    expect(
      optionListsOf([
        { options: { colour: 'Teal', size: 'L' } },
        { options: { colour: 'Rust', size: 'S' } },
        { options: { colour: 'Teal', size: 'S' } },
      ]),
    ).toEqual({ sizes: ['S', 'L'], colours: ['Teal', 'Rust'] });
  });
});
