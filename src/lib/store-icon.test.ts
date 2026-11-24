import { describe, expect, it } from 'vitest';
import { storeIcon } from './store-icon';

const colors = { primary: '#123456', background: '#ffffff' };
const svg = (name: string) =>
  decodeURIComponent(storeIcon(name, colors).split(',')[1]!);

describe('storeIcon', () => {
  it('shows the first letter on the main colour', () => {
    expect(svg('tara Weaves')).toContain('>T</text>');
    expect(svg('tara Weaves')).toContain('fill="#123456"');
  });

  it('skips markup and copes with no letters', () => {
    expect(svg('<b>')).toContain('>B</text>');
    expect(svg('***')).toContain('></text>');
  });
});
